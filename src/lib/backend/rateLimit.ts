/**
 * Distributed Rate Limiting Strategy for Commitlabs Public API Endpoints.
 * 
 * This implementation uses @upstash/ratelimit with Redis for distributed,
 * serverless-ready rate limiting.
 * 
 * Required Environment Variables:
 * - UPSTASH_REDIS_REST_URL: The REST URL of the Upstash Redis instance.
 * - UPSTASH_REDIS_REST_TOKEN: The REST token for the Upstash Redis instance.
 * 
 * Local Development:
 * If environment variables are missing, the limiter defaults to allowing all requests
 * to avoid blocking local development.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export type RateLimitRoute = 'auth' | 'commitments' | 'attestations' | 'marketplace' | 'ready' | 'default';

const POLICIES: Record<RateLimitRoute, { requests: number; window: `${number} ${"s" | "m" | "h" | "d"}` }> = {
  auth: { requests: 5, window: "1 m" },
  commitments: { requests: 20, window: "1 m" },
  attestations: { requests: 20, window: "1 m" },
  marketplace: { requests: 30, window: "1 m" },
  ready: { requests: 100, window: "1 m" },
  default: { requests: 10, window: "1 m" },
};

let redis: Redis | null = null;
const ratelimiters = new Map<RateLimitRoute, Ratelimit>();

function getRedis() {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

function getRatelimiter(routeId: string): Ratelimit | null {
  const route = (POLICIES[routeId as RateLimitRoute] ? routeId : 'default') as RateLimitRoute;
  
  if (ratelimiters.has(route)) {
    return ratelimiters.get(route)!;
  }

  const client = getRedis();
  if (!client) return null;

  const policy = POLICIES[route];
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(policy.requests, policy.window),
    analytics: true,
    prefix: `@commitlabs/ratelimit/${route}`,
  });

  ratelimiters.set(route, limiter);
  return limiter;
}

/**
 * Checks if a request should be rate limited.
 * 
 * @param key - A unique identifier for the requester (e.g., IP address, user ID, API key).
 * @param routeId - identifier for the specific route or resource being accessed.
 * @returns Promise<RateLimitResult> - Metadata about the rate limit status.
 */
export async function checkRateLimit(key: string, routeId: string): Promise<RateLimitResult> {
    const isDev = process.env.NODE_ENV === 'development';
    const limiter = getRatelimiter(routeId);

    if (!limiter) {
        if (!isDev) {
            console.warn(`[RateLimit] Production: Upstash Redis not configured. Allowing request for ${routeId}.`);
        }
        return { success: true, limit: 0, remaining: 0, reset: 0 };
    }

    try {
        const result = await limiter.limit(key);
        return {
            success: result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
        };
    } catch (error) {
        console.error(`[RateLimit] Error checking rate limit for ${routeId}:`, error);
        // Fail open in case of infrastructure failure to avoid service outage
        return { success: true, limit: 0, remaining: 0, reset: 0 };
    }
}

/**
 * Creates a consistent 429 Too Many Requests response with Retry-After and rate limit headers.
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
    const retryAfter = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
    
    return new Response(
        JSON.stringify({
            error: {
                code: 'TOO_MANY_REQUESTS',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter,
            }
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': retryAfter.toString(),
                'X-RateLimit-Limit': result.limit.toString(),
                'X-RateLimit-Remaining': result.remaining.toString(),
                'X-RateLimit-Reset': result.reset.toString(),
            }
        }
    );
}

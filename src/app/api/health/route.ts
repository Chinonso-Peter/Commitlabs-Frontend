import { NextRequest, NextResponse } from 'next/server';
import {
    applyCorsPolicy,
    createCorsOptionsHandler,
    enforceCorsRequestPolicy,
    toCorsErrorResponse,
    type CorsRoutePolicy,
} from '@/lib/backend/cors';
import { attachSecurityHeaders } from '@/utils/response';

const HEALTH_CORS_POLICY = {
    GET: { access: 'public' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(HEALTH_CORS_POLICY);

export async function GET(request: NextRequest) {
    try {
        enforceCorsRequestPolicy(request, HEALTH_CORS_POLICY);
    } catch (error) {
        return toCorsErrorResponse(error);
    }

    const response = NextResponse.json(
        {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
        },
        { status: 200 }
    );

    attachSecurityHeaders(response);
    return applyCorsPolicy(request, response, HEALTH_CORS_POLICY);
}

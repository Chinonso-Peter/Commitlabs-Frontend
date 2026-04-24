import { NextRequest } from 'next/server';
import { logWarn, logError } from './logger';
import { fail } from './apiResponse';
import { ApiError } from './errors';
import {
    applyCorsPolicy,
    enforceCorsRequestPolicy,
    type CorsRoutePolicy,
} from './cors';

type RouteHandler = (
    req: NextRequest,
    context: { params: Record<string, string> }
) => Promise<Response>;

interface ApiHandlerOptions {
    cors?: CorsRoutePolicy;
}

/**
 * withApiHandler
 *
 * Wraps a Next.js App Router route handler so that:
 *  - Known `ApiError` subclasses are converted into clean JSON error responses
 *    at the appropriate HTTP status code.
 *  - Unknown errors are logged and converted into generic 500 responses.
 *
 * @example
 * ```ts
 * // app/api/commitments/route.ts
 * import { withApiHandler } from '@/lib/backend/withApiHandler';
 * import { ok } from '@/lib/backend/apiResponse';
 *
 * export const GET = withApiHandler(async (req) => {
 *   const commitments = await getCommitments();
 *   return ok(commitments);
 * });
 * ```
 */
export function withApiHandler(
    handler: RouteHandler,
    options: ApiHandlerOptions = {}
): RouteHandler {
    return async function wrappedHandler(
        req: NextRequest,
        context: { params: Record<string, string> } = { params: {} }
    ): Promise<Response> {
        try {
            if (options.cors) {
                enforceCorsRequestPolicy(req, options.cors);
            }

            const response = await handler(req, context);
            return options.cors ? applyCorsPolicy(req, response, options.cors) : response;
        } catch (err: unknown) {
            if (err instanceof ApiError) {
                logWarn(req, '[API] Handled error', {
                    code: err.code,
                    status: err.statusCode,
                    message: err.message,
                    url: req.url,
                    method: req.method,
                });

                const response = fail(err.code, err.message, err.details, err.statusCode);
                return options.cors ? applyCorsPolicy(req, response, options.cors) : response;
            }

            const error = err instanceof Error ? err : new Error(String(err));

            logError(req, '[API] Unhandled exception', error, {
                url: req.url,
                method: req.method,
            });

            const response = fail(
                'INTERNAL_ERROR',
                'An unexpected error occurred. Please try again later.',
                undefined,
                500
            );
            return options.cors ? applyCorsPolicy(req, response, options.cors) : response;
        }
    };
}

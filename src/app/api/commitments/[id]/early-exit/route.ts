import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import {
    applyCorsPolicy,
    createCorsOptionsHandler,
    enforceCorsRequestPolicy,
    toCorsErrorResponse,
    type CorsRoutePolicy,
} from '@/lib/backend/cors';
import { logEarlyExit } from '@/lib/backend/logger';

interface Params {
    params: { id: string };
}

const COMMITMENT_EARLY_EXIT_CORS_POLICY = {
    POST: { access: 'first-party' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(COMMITMENT_EARLY_EXIT_CORS_POLICY);

export async function POST(req: NextRequest, { params }: Params) {
    try {
        enforceCorsRequestPolicy(req, COMMITMENT_EARLY_EXIT_CORS_POLICY);
    } catch (error) {
        return toCorsErrorResponse(error);
    }

    const { id } = params;

    const ip = req.ip || req.headers.get('x-forwarded-for') || 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/commitments/early-exit');
    if (!isAllowed) {
        return applyCorsPolicy(
            req,
            NextResponse.json({ error: 'Too many requests' }, { status: 429 }),
            COMMITMENT_EARLY_EXIT_CORS_POLICY
        );
    }

    // TODO: perform early exit processing (penalty calculation, contract call, etc.)
    try {
        const body = await req.json();
        logEarlyExit({ ip, commitmentId: id, ...body });
    } catch {
        logEarlyExit({ ip, commitmentId: id, error: 'failed to parse request body' });
    }

    return applyCorsPolicy(
        req,
        NextResponse.json({
            message: `Stub early-exit endpoint for commitment ${id}`,
            commitmentId: id
        }),
        COMMITMENT_EARLY_EXIT_CORS_POLICY
    );
}

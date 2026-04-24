import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, ForbiddenError, ConflictError } from '@/lib/backend/errors';
import { earlyExitCommitmentOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { logEarlyExit } from '@/lib/backend/logger';

const EarlyExitRequestSchema = z.object({
    actorAddress: z.string().min(1, 'Actor address is required'),
    callerAddress: z.string().optional(),
});

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    const isAllowed = await checkRateLimit(ip, 'api/commitments/early-exit');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    if (!id || id.trim().length === 0) {
        throw new ValidationError('Commitment ID is required');
    }

    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const authValidation = EarlyExitRequestSchema.safeParse(body);
    if (!authValidation.success) {
        throw new ValidationError('Invalid request data', authValidation.error.errors);
    }

    const { actorAddress, callerAddress } = authValidation.data;

    const commitment = await getCommitmentFromChain(id);

    if (commitment.ownerAddress.toLowerCase() !== actorAddress.toLowerCase()) {
        throw new ForbiddenError('You do not own this commitment');
    }

    if (commitment.status === 'SETTLED') {
        throw new ConflictError('Commitment has already been settled and cannot be exited early');
    }

    if (commitment.status === 'EARLY_EXIT') {
        throw new ConflictError('Commitment has already been exited early');
    }

    if (commitment.status === 'VIOLATED') {
        throw new ConflictError('Commitment has been violated and cannot be exited early');
    }

    try {
        const exitResult = await earlyExitCommitmentOnChain({
            commitmentId: id,
            callerAddress,
        });

        logEarlyExit({
            ip,
            commitmentId: id,
            callerAddress,
            exitAmount: exitResult.exitAmount,
            penaltyAmount: exitResult.penaltyAmount,
            finalStatus: exitResult.finalStatus,
            txHash: exitResult.txHash,
        });

        return ok({
            commitmentId: id,
            exitAmount: exitResult.exitAmount,
            penaltyAmount: exitResult.penaltyAmount,
            finalStatus: exitResult.finalStatus,
            txHash: exitResult.txHash,
            reference: exitResult.reference,
            exitedAt: new Date().toISOString(),
        });
    } catch (error) {
        logEarlyExit({
            ip,
            commitmentId: id,
            callerAddress,
            error: error instanceof Error ? error.message : 'Unknown early exit error',
        });

        if (
            error instanceof ValidationError ||
            error instanceof ForbiddenError ||
            error instanceof ConflictError
        ) {
            throw error;
        }

        throw error;
    }
});
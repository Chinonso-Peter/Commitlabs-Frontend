import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { TooManyRequestsError, ValidationError, NotFoundError, ConflictError, ForbiddenError, UnauthorizedError, BadRequestError } from '@/lib/backend/errors';
import { settleCommitmentOnChain, getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { logCommitmentSettled } from '@/lib/backend/logger';

// Request validation schema
const SettleRequestSchema = z.object({
    callerAddress: z.string().min(5, 'Invalid caller address').optional(),
});

interface Params {
    params: { id: string };
}

export const POST = withApiHandler(async (req: NextRequest, { params }: Params) => {
    const { id } = params;
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';

    // Rate limiting
    const isAllowed = await checkRateLimit(ip, 'api/commitments/settle');
    if (!isAllowed) {
        throw new TooManyRequestsError();
    }

    // Validate commitment ID
    if (!id || id.trim().length === 0) {
        throw new ValidationError('Commitment ID is required');
    }

    // Parse and validate request body
    let body;
    try {
        body = await req.json();
    } catch {
        throw new ValidationError('Invalid JSON in request body');
    }

    const validation = SettleRequestSchema.safeParse(body);
    if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.errors);
    }

    const { callerAddress } = validation.data;

    // Authenticate: callerAddress is required for settlement
    if (!callerAddress) {
        throw new UnauthorizedError('Authentication required. Provide callerAddress in request body.');
    }

    try {
        // Read-before-write to validate eligibility
        const commitment = await getCommitmentFromChain(id);

        if (!commitment || commitment.status === 'UNKNOWN') {
            throw new NotFoundError('Commitment', { commitmentId: id });
        }

        // Enforce actor matches owner (session principal)
        if (commitment.ownerAddress && commitment.ownerAddress !== callerAddress) {
            throw new ForbiddenError('You do not have permission to settle this commitment.');
        }

        // Handle invalid states - commitment must be in valid state to settle
        if (commitment.status === 'SETTLED') {
            throw new ConflictError('Commitment has already been settled.');
        }

        if (commitment.status === 'VIOLATED') {
            throw new BadRequestError('Commitment has been violated and cannot be settled.');
        }

        if (commitment.status === 'EARLY_EXIT') {
            throw new BadRequestError('Commitment has exited early and cannot be settled.');
        }

        // Call the settlement function
        const settlementResult = await settleCommitmentOnChain({
            commitmentId: id,
            callerAddress,
        });

        // Log successful settlement
        logCommitmentSettled({
            ip,
            commitmentId: id,
            callerAddress,
            settlementAmount: settlementResult.settlementAmount,
            finalStatus: settlementResult.finalStatus,
            txHash: settlementResult.txHash,
        });

        // Return success response
        return ok({
            commitmentId: id,
            settlementAmount: settlementResult.settlementAmount,
            finalStatus: settlementResult.finalStatus,
            txHash: settlementResult.txHash,
            reference: settlementResult.reference,
            settledAt: new Date().toISOString(),
        });

    } catch (error) {
        // Log failed settlement attempt
        logCommitmentSettled({
            ip,
            commitmentId: id,
            callerAddress,
            error: error instanceof Error ? error.message : 'Unknown settlement error',
        });

        // Re-throw known errors to be handled by withApiHandler
        if (
            error instanceof ValidationError ||
            error instanceof NotFoundError ||
            error instanceof ConflictError ||
            error instanceof ForbiddenError ||
            error instanceof UnauthorizedError
        ) {
            throw error;
        }

        // Unknown errors will be caught by withApiHandler
        throw error;
    }
});
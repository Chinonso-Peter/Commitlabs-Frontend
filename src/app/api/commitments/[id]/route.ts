/**
 * GET /api/commitments/[id]
 *
 * Fetches a single commitment by ID from the Soroban chain via the contracts service.
 *
 * Response shape:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "commitmentId": "CMT-001",
 *     "owner": "GABC...",
 *     "asset": "XLM",
 *     "amount": "50000",
 *     "currentValue": "52000",
 *     "status": "ACTIVE",
 *     "complianceScore": 95,
 *     "feeEarned": "0",
 *     "violationCount": 0,
 *     "createdAt": "2026-01-10T00:00:00Z",
 *     "expiresAt": "2026-03-11T00:00:00Z",
 *     "daysRemaining": 45,
 *     "maxLossPercent": null,
 *     "nftMetadataLink": null
 *   }
 * }
 * ```
 *
 * Error codes:
 *   404 NOT_FOUND           — commitment does not exist on chain
 *   502 BLOCKCHAIN_CALL_FAILED — upstream RPC failure
 *   500 INTERNAL_ERROR      — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import {
  NotFoundError,
  normalizeBackendError,
  toBackendErrorResponse,
  BackendError,
} from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getCommitmentFromChain } from '@/lib/backend/services/contracts';
import { contractAddresses } from '@/utils/soroban';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysRemaining(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / msPerDay));
}

function getNftMetadataLink(commitmentId: string): string | null {
  const nftContract = contractAddresses.commitmentNFT;
  if (!nftContract) return null;
  return `${nftContract}/metadata/${commitmentId}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET = withApiHandler(async (
  _req: NextRequest,
  context: { params: Record<string, string> }
) => {
  const commitmentId = context.params.id;

  let commitment;
  try {
    commitment = await getCommitmentFromChain(commitmentId);
  } catch (err) {
    // Distinguish a known "not found" BackendError from a generic upstream failure
    if (err instanceof BackendError && err.code === 'NOT_FOUND') {
      throw new NotFoundError('Commitment', { commitmentId });
    }

    // All other upstream failures → 502
    const normalized = normalizeBackendError(err, {
      code: 'BLOCKCHAIN_CALL_FAILED',
      message: 'Unable to fetch commitment from chain.',
      status: 502,
      details: { commitmentId },
    });
    return NextResponse.json(toBackendErrorResponse(normalized), {
      status: normalized.status,
    });
  }

  // getCommitmentFromChain returns a commitment or throws — a null/undefined
  // result means the chain returned an empty payload, treat as not found.
  if (!commitment || !commitment.id) {
    throw new NotFoundError('Commitment', { commitmentId });
  }

  const response = {
    commitmentId: commitment.id,
    owner: commitment.ownerAddress,
    asset: commitment.asset,
    amount: commitment.amount,
    currentValue: commitment.currentValue,
    status: commitment.status,
    complianceScore: commitment.complianceScore,
    feeEarned: commitment.feeEarned,
    violationCount: commitment.violationCount,
    createdAt: commitment.createdAt ?? null,
    expiresAt: commitment.expiresAt ?? null,
    daysRemaining: getDaysRemaining(commitment.expiresAt),
    // maxLossPercent is not part of ChainCommitment — kept for API compatibility
    maxLossPercent: null,
    nftMetadataLink: getNftMetadataLink(commitment.id),
  };

  return ok(response);
});


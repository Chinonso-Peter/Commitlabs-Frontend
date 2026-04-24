import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/commitments/[id]/settle/route'
import { createMockRequest, parseResponse } from './helpers'
import * as contractsModule from '@/lib/backend/services/contracts'

vi.mock('@/lib/backend/services/contracts', async () => {
  const actual = await vi.importActual('@/lib/backend/services/contracts')
  return {
    ...actual,
    settleCommitmentOnChain: vi.fn(),
    getCommitmentFromChain: vi.fn(),
  }
})

vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

describe('POST /api/commitments/[id]/settle', () => {
  const mockCommitmentId = 'test-commitment-123'
  const mockOwnerAddress = 'GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z'
  const mockCallerAddress = 'GD5TIP5CKNSV7QZP2FGV6BOB7ZHQG4T4S5R6K4YZJ2MJJQ6XZM4XJQ5Z'
  const otherAddress = 'GCZ7Z7K5X5D4X3A2B1C0D9E8F7A6B5C4D3E2F1G0H9I8J7K6L5M4'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 and settle commitment when authorized owner calls', async () => {
    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue({
      id: mockCommitmentId,
      ownerAddress: mockOwnerAddress,
      status: 'ACTIVE',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    vi.mocked(contractsModule.settleCommitmentOnChain).mockResolvedValue({
      settlementAmount: '1000.50',
      finalStatus: 'SETTLED',
      txHash: 'abc123hash',
    })

    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: { callerAddress: mockCallerAddress },
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data).toHaveProperty('commitmentId', mockCommitmentId)
    expect(result.data.data).toHaveProperty('settlementAmount', '1000.50')
    expect(result.data.data).toHaveProperty('finalStatus', 'SETTLED')
  })

  it('should return 401 when callerAddress is not provided', async () => {
    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: {},
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(401)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toHaveProperty('code', 'UNAUTHORIZED')
  })

  it('should return 403 when caller is not the owner', async () => {
    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue({
      id: mockCommitmentId,
      ownerAddress: mockOwnerAddress,
      status: 'ACTIVE',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: { callerAddress: otherAddress },
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(403)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toHaveProperty('code', 'FORBIDDEN')
  })

  it('should return 409 when commitment is already settled', async () => {
    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue({
      id: mockCommitmentId,
      ownerAddress: mockOwnerAddress,
      status: 'SETTLED',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: { callerAddress: mockCallerAddress },
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(409)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toHaveProperty('code', 'CONFLICT')
    expect(result.data.error.message).toContain('already been settled')
  })

  it('should return 400 when commitment status is VIOLATED', async () => {
    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue({
      id: mockCommitmentId,
      ownerAddress: mockOwnerAddress,
      status: 'VIOLATED',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: { callerAddress: mockCallerAddress },
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toHaveProperty('code', 'BAD_REQUEST')
    expect(result.data.error.message).toContain('violated')
  })

  it('should return 400 when commitment status is EARLY_EXIT', async () => {
    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue({
      id: mockCommitmentId,
      ownerAddress: mockOwnerAddress,
      status: 'EARLY_EXIT',
      expiresAt: '2020-01-01T00:00:00.000Z',
    })

    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: { callerAddress: mockCallerAddress },
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(400)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toHaveProperty('code', 'BAD_REQUEST')
    expect(result.data.error.message).toContain('early')
  })

  it('should return 404 when commitment not found', async () => {
    vi.mocked(contractsModule.getCommitmentFromChain).mockResolvedValue({
      id: mockCommitmentId,
      ownerAddress: '',
      status: 'UNKNOWN',
    } as any)

    const request = createMockRequest(
      `http://localhost:3000/api/commitments/${mockCommitmentId}/settle`,
      {
        method: 'POST',
        body: { callerAddress: mockCallerAddress },
      }
    )

    const response = await POST(request, { params: { id: mockCommitmentId } })
    const result = await parseResponse(response)

    expect(result.status).toBe(404)
    expect(result.data.success).toBe(false)
    expect(result.data.error).toHaveProperty('code', 'NOT_FOUND')
  })
})
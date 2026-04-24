import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '@/app/api/commitments/route'
import { createMockRequest, parseResponse } from './helpers'

describe('GET /api/commitments', () => {
  it('should return a list of commitments with default parameters', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    )
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data).toHaveProperty('data')
    expect(result.data.data).toHaveProperty('total')
  })

  it('should include security headers on response', async () => {
    const request = createMockRequest(
      'http://localhost:3000/api/commitments?ownerAddress=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    )
    const response = await GET(request)
    const headers = response.headers

    expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'")
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})

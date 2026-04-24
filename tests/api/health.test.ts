import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { createMockRequest, parseResponse } from './helpers'

describe('GET /api/health', () => {
  it('should return a 200 status with health status', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    expect(result.status).toBe(200)
    expect(result.data.success).toBe(true)
    expect(result.data.data.status).toBe('ok')
    expect(result.data.data.timestamp).toBeDefined()
  })

  it('should return ISO timestamp in response', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const result = await parseResponse(response)

    const timestamp = new Date(result.data.data.timestamp)
    expect(timestamp).toBeInstanceOf(Date)
    expect(timestamp.toString()).not.toBe('Invalid Date')
  })

  it('should include security headers', async () => {
    const request = createMockRequest('http://localhost:3000/api/health')
    const response = await GET(request)
    const headers = response.headers

    expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'")
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('X-XSS-Protection')).toBe('1; mode=block')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})

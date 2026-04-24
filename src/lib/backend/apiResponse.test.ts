import { describe, it, expect } from 'vitest';
import { ok, fail } from './apiResponse';

describe('apiResponse security headers', () => {
  const SECURITY_HEADERS = [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
  ] as const;

  describe('ok()', () => {
    it('should attach security headers to success response', () => {
      const response = ok({ message: 'test' });
      const headers = response.headers;

      expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'");
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should attach security headers with custom CSP', () => {
      const response = ok({ message: 'test' }, 200);
      // Note: ok() doesn't currently support custom CSP - this tests baseline
      const headers = response.headers;
      
      expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    });

    it('should include success: true in body', async () => {
      const response = ok({ id: 1 });
      const body = await response.json();
      
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ id: 1 });
    });
  });

  describe('fail()', () => {
    it('should attach security headers to error response', () => {
      const response = fail('NOT_FOUND', 'Resource not found', undefined, 404);
      const headers = response.headers;

      expect(headers.get('Content-Security-Policy')).toBe("default-src 'self'");
      expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headers.get('X-Frame-Options')).toBe('DENY');
      expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should include success: false and error details in body', async () => {
      const response = fail('INVALID_REQUEST', 'Missing required field', { field: 'email' }, 400);
      const body = await response.json();
      
      expect(body.success).toBe(false);
      expect(body.error).toEqual({
        code: 'INVALID_REQUEST',
        message: 'Missing required field',
        details: { field: 'email' },
      });
    });

    it('should use correct HTTP status code', () => {
      const response = fail('ERROR', 'Error message', undefined, 500);
      
      expect(response.status).toBe(500);
    });
  });
});
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyCorsPolicy,
    createCorsOptionsHandler,
    enforceCorsRequestPolicy,
    type CorsRoutePolicy,
} from './cors';

const ORIGINAL_ENV = {
    firstParty: process.env.COMMITLABS_FIRST_PARTY_ORIGINS,
    publicApi: process.env.COMMITLABS_PUBLIC_API_ORIGINS,
};

afterEach(() => {
    process.env.COMMITLABS_FIRST_PARTY_ORIGINS = ORIGINAL_ENV.firstParty;
    process.env.COMMITLABS_PUBLIC_API_ORIGINS = ORIGINAL_ENV.publicApi;
    vi.restoreAllMocks();
});

describe('cors helper', () => {
    it('applies wildcard CORS headers to public responses', () => {
        const policy = {
            GET: { access: 'public' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/health', {
            method: 'GET',
            headers: { Origin: 'https://external.example' },
        });

        const response = applyCorsPolicy(
            request,
            NextResponse.json({ status: 'healthy' }),
            policy
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
        expect(response.headers.get('Vary')).toContain('Origin');
    });

    it('echoes allowed first-party origins and enables credentials', () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            POST: { access: 'first-party' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'POST',
            headers: { Origin: 'https://app.commitlabs.test' },
        });

        const response = applyCorsPolicy(
            request,
            NextResponse.json({ success: true }),
            policy
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.commitlabs.test'
        );
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('rejects disallowed first-party origins', () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            POST: { access: 'first-party' },
        } satisfies CorsRoutePolicy;

        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'POST',
            headers: { Origin: 'https://evil.example' },
        });

        expect(() => enforceCorsRequestPolicy(request, policy)).toThrowError(
            /Origin is not allowed/
        );
    });

    it('builds method-aware preflight responses for mixed public and first-party routes', async () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            GET: { access: 'public' },
            POST: {
                access: 'first-party',
                allowHeaders: ['Authorization', 'Content-Type'],
            },
        } satisfies CorsRoutePolicy;

        const handler = createCorsOptionsHandler(policy);
        const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://app.commitlabs.test',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Authorization, Content-Type',
            },
        });

        const response = await handler(request);

        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
            'https://app.commitlabs.test'
        );
        expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
            'Authorization, Content-Type'
        );
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
            'GET, POST, OPTIONS'
        );
    });

    it('rejects preflight requests with headers outside the allowlist', async () => {
        process.env.COMMITLABS_FIRST_PARTY_ORIGINS = 'https://app.commitlabs.test';

        const policy = {
            POST: {
                access: 'first-party',
                allowHeaders: ['Content-Type'],
            },
        } satisfies CorsRoutePolicy;

        const handler = createCorsOptionsHandler(policy);
        const request = new NextRequest('http://localhost:3000/api/auth', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://app.commitlabs.test',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'X-Custom-Header',
            },
        });

        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error.code).toBe('FORBIDDEN');
    });
});

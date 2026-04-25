# Backend API Reference

Base URL: /api
Content-Type: application/json
Auth: Routes marked [auth] require a valid session token.
Rate limiting is enforced per-IP on all major routes.

## Endpoint Matrix

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth | no | Session creation stub |
| POST | /api/auth/nonce | no | Request wallet sign-in nonce |
| POST | /api/auth/verify | no | Verify wallet signature |
| POST | /api/login | no | Mock login dev only |
| GET | /api/commitments | yes | List commitments for wallet |
| POST | /api/commitments | yes | Create on-chain commitment |
| GET | /api/commitments/[id] | yes | Get single commitment |
| POST | /api/commitments/[id]/settle | yes | Settle a commitment |
| POST | /api/commitments/[id]/early-exit | yes | Early exit from commitment |
| GET | /api/marketplace | no | List listings generic |
| POST | /api/marketplace | no | Create listing generic |
| GET | /api/marketplace/listings | no | List listings filterable |
| POST | /api/marketplace/listings | no | Create listing |
| GET | /api/attestations | no | List attestations |
| POST | /api/attestations | no | Record attestation on-chain |
| GET | /api/analytics/user | no | User analytics by wallet |
| GET | /api/metrics | no | Platform health metrics |
| GET | /api/health | no | Liveness check |
| GET | /api/ready | no | Readiness check Soroban RPC |
| POST | /api/seed | no | Seed mock data dev only |

## Auth

### POST /api/auth
Session creation stub. Rate-limited per IP. Pending issue 126.
Success 200: { ok: true, data: { message: Authentication successful. } }
Error 429: TOO_MANY_REQUESTS - Rate limit exceeded

### POST /api/auth/nonce
Request a one-time nonce for wallet sign-in. Rate-limited per IP.
Request body: { address: GABC...XYZ }
Success 200: { ok: true, data: { nonce: a1b2c3, message: Sign this message..., expiresAt: 2026-04-24T12:05:00.000Z } }
Error 400: VALIDATION_ERROR - Missing or invalid address
Error 429: TOO_MANY_REQUESTS - Rate limit exceeded

### POST /api/auth/verify
Verify signed challenge and create session. Rate-limited per IP.
Request body: { address, signature, message }
Success 200: { ok: true, data: { verified: true, address, sessionToken: placeholder, sessionType: placeholder } }
Error 400: VALIDATION_ERROR - Missing or invalid fields
Error 401: UNAUTHORIZED - Signature verification failed
Error 429: TOO_MANY_REQUESTS - Rate limit exceeded

### POST /api/login
Mock login for development. Success 200: { success: true, message: Login successful (mock) }

## Commitments

### GET /api/commitments
List on-chain commitments for a wallet. Rate-limited per IP.
Query params: ownerAddress (required), page (default 1), pageSize (default 10, max 100)
Success 200: { ok: true, data: { items: [...], page: 1, pageSize: 10, total: 1 } }
Error 400: BAD_REQUEST - Missing ownerAddress or invalid pagination
Error 429: TOO_MANY_REQUESTS - Rate limit exceeded

### POST /api/commitments
Create a new on-chain commitment. Rate-limited per IP.
Required fields: ownerAddress, asset, amount (string), durationDays (>0), maxLossBps (>=0)
Optional fields: metadata (object)
Success 201: { ok: true, data: { commitmentId, ownerAddress, asset, amount, status: ACTIVE, createdAt, expiresAt } }
Error 400: BAD_REQUEST - Invalid or missing fields
Error 429: TOO_MANY_REQUESTS - Rate limit exceeded

### GET /api/commitments/[id]
Fetch a single commitment by ID.
Success 200: { ok: true, data: { commitmentId, ownerAddress, asset, amount, status, complianceScore, violationCount, createdAt, expiresAt } }
Error 404: NOT_FOUND - Commitment does not exist

### POST /api/commitments/[id]/settle
Settle a commitment at natural expiry.
Success 200: { ok: true, data: { commitmentId, status: SETTLED, settledAt } }
Error 404: NOT_FOUND - Commitment not found
Error 400: BAD_REQUEST - Not eligible for settlement

### POST /api/commitments/[id]/early-exit
Trigger early exit from an active commitment.
Success 200: { ok: true, data: { commitmentId, status: EXITED, exitedAt } }
Error 404: NOT_FOUND - Commitment not found
Error 400: BAD_REQUEST - Not eligible for early exit

## Marketplace

### GET /api/marketplace
List listings with optional filters. Query params: page, limit, category, minPrice, maxPrice.
Success 200: { listings: [...], pagination: { page, limit }, total: 1 }

### POST /api/marketplace
Create a listing. Body: { title, description, price, category, sellerAddress }
Success 201: { id, title, price, category, seller, createdAt }

### GET /api/marketplace/listings
List with advanced filtering. Rate-limited per IP.
Query params: type (Safe/Balanced/Aggressive), minCompliance, maxLoss, minAmount, maxAmount, sortBy
Success 200: { ok: true, data: { listings: [...], cards: [...], total: 1 } }
Error 400: VALIDATION_ERROR - Invalid filter or sort param
Error 500: INTERNAL_ERROR - Failed to fetch listings

### POST /api/marketplace/listings
Create a new listing. Body: { commitmentId, price, sellerAddress }
Success 201: { ok: true, data: { listing: { listingId, commitmentId, price, sellerAddress, createdAt } } }
Error 400: VALIDATION_ERROR - Invalid or missing fields

## Attestations

### GET /api/attestations
List all attestations from mock database. Rate-limited per IP.
Success 200: { ok: true, data: { attestations: [ { id, commitmentId, provider, status, timestamp } ] } }
Error 429: TOO_MANY_REQUESTS - Rate limit exceeded

### POST /api/attestations
Record an attestation on-chain. Rate-limited per IP.

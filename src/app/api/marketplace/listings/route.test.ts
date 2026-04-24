import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { marketplaceService, listMarketplaceListings, isMarketplaceSortBy } from '@/lib/backend/services/marketplace';
import { ValidationError, ConflictError } from '@/lib/backend/errors';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import type { MarketplaceListing, MarketplacePublicListing } from '@/lib/types/domain';

// Mock the marketplace service and related functions
vi.mock('@/lib/backend/services/marketplace', () => ({
  marketplaceService: {
    createListing: vi.fn(),
  },
  listMarketplaceListings: vi.fn(),
  isMarketplaceSortBy: vi.fn(),
  getMarketplaceSortKeys: vi.fn(() => ['price', 'amount']),
}));

// Mock rate limiting
vi.mock('@/lib/backend/rateLimit', () => ({
  checkRateLimit: vi.fn(),
}));

describe('POST /api/marketplace/listings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a listing successfully', async () => {
    const mockListing: MarketplaceListing = {
      id: 'listing_1_1234567890',
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      status: 'Active',
      createdAt: '2026-02-25T10:00:00.000Z',
      updatedAt: '2026-02-25T10:00:00.000Z',
    };

    vi.mocked(marketplaceService.createListing).mockResolvedValue(mockListing);

    const requestBody = {
      commitmentId: 'commitment_123',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.listing).toEqual(mockListing);
    expect(marketplaceService.createListing).toHaveBeenCalledWith(requestBody);
  });

  it('should return 400 when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when request body is not an object', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify('string instead of object'),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when request body is null', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(null),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should propagate validation errors from service', async () => {
    const validationError = new ValidationError('Invalid listing request', {
      errors: ['price must be a positive number'],
    });

    vi.mocked(marketplaceService.createListing).mockRejectedValue(validationError);

    const requestBody = {
      commitmentId: 'commitment_123',
      price: '-100',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('should propagate conflict errors from service', async () => {
    const conflictError = new ConflictError('Commitment is already listed on the marketplace.');

    vi.mocked(marketplaceService.createListing).mockRejectedValue(conflictError);

    const requestBody = {
      commitmentId: 'commitment_duplicate',
      price: '1000.50',
      currencyAsset: 'USDC',
      sellerAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    };

    const request = new NextRequest('http://localhost:3000/api/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, { params: {} });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/marketplace/listings', () => {
  const mockPublicListings: MarketplacePublicListing[] = [
    {
      listingId: 'LST-001',
      commitmentId: 'CMT-001',
      type: 'Safe',
      amount: 50000,
      remainingDays: 25,
      maxLoss: 2,
      currentYield: 5.2,
      complianceScore: 95,
      price: 52000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(listMarketplaceListings).mockResolvedValue(mockPublicListings);
    vi.mocked(isMarketplaceSortBy).mockImplementation((val) => ['price', 'amount'].includes(val));
  });

  it('should return listings with cards successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.listings).toEqual(mockPublicListings);
    expect(data.data.cards).toHaveLength(1);
    expect(data.data.cards[0].amount).toBe('$50,000');
    expect(data.data.total).toBe(1);
  });

  it('should parse filters correctly and map type case-insensitively', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?type=SAFE&minAmount=1000&maxAmount=5000&sortBy=price');
    await GET(request);

    expect(listMarketplaceListings).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Safe',
      minAmount: 1000,
      maxAmount: 5000,
      sortBy: 'price',
    }));
  });

  it('should return 400 for invalid type', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?type=invalid');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toContain("Invalid 'type' query param");
  });

  it('should return 400 for non-numeric params', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?minAmount=abc');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.message).toContain("Invalid 'minAmount' query param");
  });

  it('should return 400 when minAmount > maxAmount', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?minAmount=5000&maxAmount=1000');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toContain("cannot be greater than");
  });

  it('should return 400 for invalid sortBy', async () => {
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings?sortBy=invalid_key');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toContain("Invalid 'sortBy' query param");
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });

  it('should return 500 for unexpected errors', async () => {
    vi.mocked(listMarketplaceListings).mockRejectedValue(new Error('Database explosion'));
    const request = new NextRequest('http://localhost:3000/api/marketplace/listings');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('Database explosion');
  });
});

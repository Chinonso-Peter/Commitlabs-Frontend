import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { createCorsOptionsHandler, type CorsRoutePolicy } from '@/lib/backend/cors';
import type { HealthMetrics } from '@/lib/types/domain';

const METRICS_CORS_POLICY = {
  GET: { access: 'public' },
} satisfies CorsRoutePolicy;

export const OPTIONS = createCorsOptionsHandler(METRICS_CORS_POLICY);

export const GET = withApiHandler(async () => {
  const metrics: HealthMetrics = {
    status: 'up',
    uptime: process.uptime(),
    mock_requests_total: Math.floor(Math.random() * 1000),
    mock_errors_total: Math.floor(Math.random() * 10),
    timestamp: new Date().toISOString(),
  };

  return ok(metrics);
}, { cors: METRICS_CORS_POLICY });

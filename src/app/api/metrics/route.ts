import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import type { HealthMetrics } from '@/lib/types/domain';
import { getCountersAdapter } from '@/lib/backend/counters/provider';

export const GET = withApiHandler(async () => {
  const countersAdapter = getCountersAdapter();
  const metrics: HealthMetrics = {
    status: 'up',
    uptime: process.uptime(),
    ...(await countersAdapter.getMetrics()),
  };

  return ok(metrics);
});
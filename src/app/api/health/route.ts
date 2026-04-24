import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/backend/withApiHandler'
import { logInfo } from '@/lib/backend/logger'
import { attachSecurityHeaders } from '@/utils/response'

export const GET = withApiHandler(async (req: NextRequest) => {
  logInfo(req, 'Healthcheck requested')
  const response = NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    },
    { status: 200 }
  )
  return attachSecurityHeaders(response)
})

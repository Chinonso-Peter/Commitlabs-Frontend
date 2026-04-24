import { NextRequest } from "next/server";
import { logInfo } from "@/lib/backend/logger";
import { ok } from "@/lib/backend/apiResponse";

export async function GET(req: NextRequest) {
  logInfo(req, "Healthcheck requested");
  return ok({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
/**
 * SOAPI Backend Core Modules.
 * Enterprise Database (PostgreSQL) & Object Storage (S3-Compatible) Integration.
 */

export * from "./config/env";
export * from "./db/connection";
export * from "./storage/s3-service";
export * from "./services/voice-scribe.service";
export * from "./services/clinical-notes.service";
export * from "./services/audit.service";

import { checkDatabaseHealth } from "./db/connection";
import { checkStorageHealth } from "./storage/s3-service";

/**
 * Health check orchestrator evaluating both PostgreSQL and S3 Object Storage readiness.
 */
export async function checkSystemHealth() {
  const [db, storage] = await Promise.all([checkDatabaseHealth(), checkStorageHealth()]);

  const isHealthy = db.status === "healthy" && storage.status === "healthy";

  return {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      postgresql: db,
      objectStorage: storage,
    },
  };
}

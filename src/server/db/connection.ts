import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { serverEnv } from "../config/env";

/**
 * Enterprise PostgreSQL Connection Pool.
 * Features:
 * - Connection pooling with auto-reconnection
 * - Execution time profiling & query logging
 * - ACID Transaction wrapper helper
 * - Health check & graceful shutdown
 */
export const dbPool = new Pool({
  connectionString: serverEnv.DATABASE_URL,
  max: serverEnv.DB_POOL_MAX,
  idleTimeoutMillis: serverEnv.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: serverEnv.DB_POOL_CONNECTION_TIMEOUT_MS,
  ssl:
    serverEnv.NODE_ENV === "production" && !serverEnv.DATABASE_URL.includes("localhost")
      ? { rejectUnauthorized: false }
      : false,
});

// Pool error handling
dbPool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL Pool Error:", err.message);
});

/**
 * Execute a SQL query using the connection pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = performance.now();
  try {
    const res = await dbPool.query<T>(text, params);
    const duration = Math.round(performance.now() - start);

    if (serverEnv.NODE_ENV === "development" && duration > 100) {
      console.warn(`⚠️ [Slow Query ${duration}ms]: ${text.trim().slice(0, 80)}...`);
    }

    return res;
  } catch (error) {
    console.error(`❌ [DB Query Failed]: ${text}`, error);
    throw error;
  }
}

/**
 * Execute multiple database operations within an isolated ACID transaction.
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check health and latency of the PostgreSQL connection.
 */
export async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}> {
  const start = performance.now();
  try {
    const res = await dbPool.query("SELECT version();");
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "healthy",
      latencyMs,
      serverVersion: res.rows[0]?.version,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "unhealthy",
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Gracefully close connection pool on process termination.
 */
export async function closeDatabase(): Promise<void> {
  await dbPool.end();
  console.log("🔌 PostgreSQL connection pool closed gracefully.");
}

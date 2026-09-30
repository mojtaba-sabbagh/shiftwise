import { Pool, type PoolClient } from "pg";

const globalDb = globalThis as typeof globalThis & { shiftwisePool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Add it to .env.local.");
  if (!globalDb.shiftwisePool) globalDb.shiftwisePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return globalDb.shiftwisePool;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

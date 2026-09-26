import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  // Idle client errors should never crash the process silently.
  console.error("Unexpected error on idle PostgreSQL client", err);
});

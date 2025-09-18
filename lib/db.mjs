import { sql as vercelSql } from '@vercel/postgres';
import { neon } from '@neondatabase/serverless';

// Choose the best available connection based on environment variables.
// Priority: Vercel Postgres (POSTGRES_*) → generic DATABASE_URL → other POSTGRES_* fallbacks.
export function getSql() {
  const hasVercelPg = Boolean(
    process.env.POSTGRES_URL ||
      process.env.POSTGRES_HOST ||
      process.env.POSTGRES_USER ||
      process.env.POSTGRES_DATABASE
  );
  if (hasVercelPg) return vercelSql;

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NO_SSL ||
    process.env.POSTGRES_URL;

  if (dbUrl) return neon(dbUrl);

  throw new Error('No Postgres env vars found (POSTGRES_URL or DATABASE_URL).');
}


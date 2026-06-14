import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

const databaseUrl = process.env.CENTRAL_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('CENTRAL_DATABASE_URL or DATABASE_URL is required to run central PostgreSQL migrations');
}

const migrationsDir = new URL('../../drizzle/', import.meta.url);
const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS __central_drizzle_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const applied = await sql<{ id: string }[]>`SELECT id FROM __central_drizzle_migrations WHERE id = ${file}`;
    if (applied.length > 0) {
      console.log(`central migration ${file}: already applied`);
      continue;
    }
    const body = await readFile(join(migrationsDir.pathname, file), 'utf8');
    await sql.begin(async (transaction) => {
      await transaction.unsafe(body);
      await transaction`INSERT INTO __central_drizzle_migrations (id) VALUES (${file})`;
    });
    console.log(`central migration ${file}: applied`);
  }
} finally {
  await sql.end();
}

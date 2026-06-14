import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './services/central-api/src/db/schema.ts',
  out: './services/central-api/drizzle',
  dbCredentials: {
    url: process.env.CENTRAL_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgres://localhost/retail_kiosk_central',
  },
  strict: true,
  verbose: true,
});

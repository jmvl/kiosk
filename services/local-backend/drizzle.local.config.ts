import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './services/local-backend/src/db/schema.ts',
  out: './services/local-backend/drizzle/local',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.LOCAL_BACKEND_SQLITE_PATH ?? './data/local-runtime.sqlite',
  },
});

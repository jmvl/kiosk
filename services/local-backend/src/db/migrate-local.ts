import { migrateDatabase } from './migrations.js';
import { openLocalDatabase, resolveLocalDatabasePath } from './sqlite.js';

const databasePath = resolveLocalDatabasePath();
const db = openLocalDatabase(databasePath);
try {
  migrateDatabase(db);
  console.log(`local SQLite migrations applied: ${databasePath}`);
} finally {
  db.close();
}

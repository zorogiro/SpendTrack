import { getDatabase } from './index';

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const version = versionRow?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT    NOT NULL,
        icon           TEXT,
        color          TEXT    NOT NULL,
        monthly_budget REAL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id              INTEGER PRIMARY KEY CHECK(id = 1),
        base_currency   TEXT    NOT NULL DEFAULT 'TND',
        eur_to_tnd_rate REAL    NOT NULL,
        month_start_day INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS recurring (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        amount              REAL    NOT NULL,
        currency            TEXT    NOT NULL CHECK(currency IN ('TND','EUR')),
        category_id         INTEGER NOT NULL REFERENCES categories(id),
        note                TEXT,
        frequency           TEXT    NOT NULL CHECK(frequency IN ('monthly','weekly')),
        day_of_month        INTEGER,
        day_of_week         INTEGER,
        start_date          TEXT    NOT NULL,
        end_date            TEXT,
        last_generated_date TEXT
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        amount       REAL    NOT NULL,
        currency     TEXT    NOT NULL CHECK(currency IN ('TND','EUR')),
        amount_base  REAL    NOT NULL,
        category_id  INTEGER NOT NULL REFERENCES categories(id),
        note         TEXT,
        date         TEXT    NOT NULL,
        created_at   TEXT    NOT NULL,
        recurring_id INTEGER REFERENCES recurring(id)
      );
    `);

    await db.runAsync('PRAGMA user_version = 1');
  }

  // Future migrations:
  // if (version < 2) { ... await db.runAsync('PRAGMA user_version = 2'); }
}

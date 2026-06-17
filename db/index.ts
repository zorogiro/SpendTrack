import * as SQLite from 'expo-sqlite';
import type { Category, Settings } from '../types';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('spendtrack.db');
  }
  return _db;
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY name');
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('Settings row missing — seed may not have run');
  return row;
}

export async function updateSettings(
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE settings SET
       base_currency   = COALESCE(?, base_currency),
       eur_to_tnd_rate = COALESCE(?, eur_to_tnd_rate),
       month_start_day = COALESCE(?, month_start_day)
     WHERE id = 1`,
    [
      patch.base_currency   ?? null,
      patch.eur_to_tnd_rate ?? null,
      patch.month_start_day ?? null,
    ],
  );
}

// ── Expense helpers added per screen in Phase 1 builds ───────────────────────

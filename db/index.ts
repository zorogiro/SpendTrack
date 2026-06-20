import * as SQLite from 'expo-sqlite';
import type { Category, Currency, Expense, ExpenseRow, Settings } from '../types';

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

// ── Expenses ─────────────────────────────────────────────────────────────────

export async function getExpense(id: number): Promise<Expense | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', [id]) ?? null;
}

export async function updateExpense(
  id: number,
  input: {
    amount: number;
    currency: Currency;
    amount_base: number;
    category_id: number;
    note: string | null;
    date: string;
  },
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE expenses
     SET amount = ?, currency = ?, amount_base = ?, category_id = ?, note = ?, date = ?
     WHERE id = ?`,
    [input.amount, input.currency, input.amount_base, input.category_id, input.note, input.date, id],
  );
}

export async function getExpensesForMonth(monthStartISO: string): Promise<ExpenseRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExpenseRow>(
    `SELECT e.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     WHERE e.date >= ?
     ORDER BY e.date DESC, e.created_at DESC`,
    [monthStartISO],
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function addExpense(input: {
  amount: number;
  currency: Currency;
  amount_base: number;
  category_id: number;
  note: string | null;
  date: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO expenses
       (amount, currency, amount_base, category_id, note, date, created_at, recurring_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      input.amount,
      input.currency,
      input.amount_base,
      input.category_id,
      input.note,
      input.date,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

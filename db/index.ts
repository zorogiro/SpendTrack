import * as SQLite from 'expo-sqlite';
import type { Category, CategoryTree, Currency, Expense, ExpenseRow, Settings } from '../types';

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

export async function getCategoryById(id: number): Promise<Category | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', [id]) ?? null;
}

export async function getTopCategories(): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE parent_id IS NULL ORDER BY name',
  );
}

export async function getSubcategories(parentId: number): Promise<Category[]> {
  const db = await getDatabase();
  return db.getAllAsync<Category>(
    'SELECT * FROM categories WHERE parent_id = ? ORDER BY name',
    [parentId],
  );
}

export async function getCategoryTree(): Promise<CategoryTree[]> {
  const db = await getDatabase();
  const all = await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY name');
  const tops = all.filter(c => c.parent_id === null);
  const byParent = new Map<number, Category[]>();
  for (const c of all) {
    if (c.parent_id !== null) {
      const arr = byParent.get(c.parent_id) ?? [];
      arr.push(c);
      byParent.set(c.parent_id, arr);
    }
  }
  return tops.map(c => ({ ...c, children: byParent.get(c.id) ?? [] }));
}

export async function addCategory(input: {
  name: string;
  icon: string | null;
  color: string;
  monthly_budget: number | null;
  parent_id: number | null;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, color, monthly_budget, parent_id) VALUES (?, ?, ?, ?, ?)',
    [input.name, input.icon, input.color, input.monthly_budget, input.parent_id],
  );
  return result.lastInsertRowId;
}

export async function updateCategory(
  id: number,
  patch: { name: string; icon: string | null; color: string; monthly_budget: number | null },
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE categories SET name = ?, icon = ?, color = ?, monthly_budget = ? WHERE id = ?',
    [patch.name, patch.icon, patch.color, patch.monthly_budget, id],
  );
}

// Throws 'has_children' or 'has_expenses' if deletion is blocked.
export async function deleteCategory(id: number): Promise<void> {
  const db = await getDatabase();
  const children = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?', [id],
  );
  if ((children?.n ?? 0) > 0) throw new Error('has_children');
  const expenses = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?', [id],
  );
  if ((expenses?.n ?? 0) > 0) throw new Error('has_expenses');
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
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

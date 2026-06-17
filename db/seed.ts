import { getDatabase } from './index';

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Food',          icon: '🍽️', color: '#FF6B6B' },
  { id: 2, name: 'Transport',     icon: '🚗', color: '#4ECDC4' },
  { id: 3, name: 'Housing',       icon: '🏠', color: '#45B7D1' },
  { id: 4, name: 'Health',        icon: '💊', color: '#96CEB4' },
  { id: 5, name: 'Entertainment', icon: '🎬', color: '#FFEAA7' },
  { id: 6, name: 'Shopping',      icon: '🛍️', color: '#DDA0DD' },
] as const;

// id is pinned to 1 via CHECK(id = 1) — INSERT OR IGNORE makes re-seeding safe.
// EUR→TND rate as of early 2026; user can update it in Settings.
const DEFAULT_SETTINGS = {
  id: 1,
  base_currency: 'TND',
  eur_to_tnd_rate: 3.40,
  month_start_day: 1,
} as const;

export async function seedDefaults(): Promise<void> {
  const db = await getDatabase();

  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)',
      [cat.id, cat.name, cat.icon, cat.color],
    );
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO settings (id, base_currency, eur_to_tnd_rate, month_start_day)
     VALUES (?, ?, ?, ?)`,
    [
      DEFAULT_SETTINGS.id,
      DEFAULT_SETTINGS.base_currency,
      DEFAULT_SETTINGS.eur_to_tnd_rate,
      DEFAULT_SETTINGS.month_start_day,
    ],
  );
}

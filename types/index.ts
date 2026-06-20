export type Currency = 'TND' | 'EUR';
export type Frequency = 'monthly' | 'weekly';

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  monthly_budget: number | null;
  parent_id: number | null; // NULL = top-level; schema supports arbitrary depth, UI exposes two levels
}

export interface CategoryTree extends Category {
  children: Category[]; // direct sub-categories, sorted by name; [] for leaves
}

export interface Expense {
  id: number;
  amount: number;
  currency: Currency;
  amount_base: number;
  category_id: number;
  note: string | null;
  date: string;        // ISO date YYYY-MM-DD
  created_at: string;  // ISO timestamp
  recurring_id: number | null;
}

export interface Recurring {
  id: number;
  amount: number;
  currency: Currency;
  category_id: number;
  note: string | null;
  frequency: Frequency;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  last_generated_date: string | null;
}

export interface Settings {
  id: number; // Always 1 — single row, pinned by CHECK(id = 1)
  base_currency: Currency;
  eur_to_tnd_rate: number;
  month_start_day: number;
  language: string | null; // NULL = follow device locale; 'en'|'fr'|'ar' = user override
}

export interface ExpenseRow extends Expense {
  category_name: string;
  category_color: string;
  category_icon: string | null;
}

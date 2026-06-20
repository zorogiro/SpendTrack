# SpendTrack — Project Memory

Personal daily-spending tracker with month-end projection. Mobile-first, web later.
This file is the single source of truth — keep it current as the project evolves.

## Stack

- **Expo (React Native + TypeScript)** — one codebase → iOS, Android, web. Mobile is the priority.
- **expo-sqlite** — local-first, on-device. No backend, no login in v1. Works offline.
- Tab navigation: Add · History · Summary · Settings.
- Sync (Supabase) is deferred; do not add until explicitly requested. The data model below is sync-ready.

## Core rule

Logging must be near-frictionless — the Add Expense flow should take ~3 taps max. Optimize it above everything else.

## Currency

- Multi-currency: **TND** + **EUR**. Base currency = TND.
- Each expense stored in its original currency AND as `amount_base` (converted at entry time using the stored rate).
- Never recompute `amount_base` from a live rate later — historical totals must stay fixed.
- EUR→TND rate is stored in settings and user-editable. Live fetch is a future option only.

## Data model (SQLite)

**categories**: id (pk), name, icon (nullable), color (hex), monthly_budget (real, nullable, base currency), parent_id (integer, nullable, FK → categories.id). NULL = top-level; schema supports arbitrary depth; v1 UI exposes two levels. Delete rule: blocked if category has children or expenses — user must clean up manually.

**expenses**: id (pk), amount (real, original currency), currency ('TND'|'EUR'), amount_base (real), category_id (fk → **leaf** category — a sub-category if one was chosen, otherwise a top-level category), note (nullable), date (ISO date), created_at (ISO timestamp), recurring_id (fk, nullable)

**recurring**: id (pk), amount, currency, category_id (fk), note (nullable), frequency ('monthly'|'weekly'), day_of_month (int, nullable), day_of_week (int, nullable), start_date (ISO), end_date (ISO, nullable), last_generated_date (ISO, nullable)

**settings** (single row): base_currency (default 'TND'), eur_to_tnd_rate (real), month_start_day (int, default 1)

### Schema migrations

- v1 — initial schema: categories, settings, recurring, expenses
- v2 — `ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id)` (non-destructive; existing rows become top-level)

## Projection logic

```
days_elapsed   = today - month_start + 1
days_in_month  = days in current budget month
days_remaining = days_in_month - days_elapsed

variable_spent = sum(amount_base) of non-recurring expenses this month
avg_daily_var  = variable_spent / days_elapsed
projected_var  = variable_spent + avg_daily_var * days_remaining

remaining_recurring = recurring entries due later this month, not yet generated
projected_month_total = projected_var + remaining_recurring
```
v1 may use the simple form `spent / days_elapsed * days_in_month`; add the recurring-aware version in Phase 2.

## Screens

1. **Add Expense** (hero) — amount keypad, TND/EUR toggle, category picker, optional note, date = today.
2. **History** — newest-first, grouped by day, with per-day + month-to-date totals; show original amount + currency per row.
3. **Summary** — month total, projection, category breakdown, budget progress.
4. **Categories & Budgets** — manage categories, set per-category monthly budget.
5. **Recurring** — manage recurring expenses; generate due entries on app launch.
6. **Settings** — base currency, EUR→TND rate, month start day, CSV export.

## Conventions

- TypeScript strict. Functional components + hooks.
- Keep DB access in a dedicated `db/` layer; screens never write raw SQL inline.
- Schema changes go through a migrations file.
- Small, reviewable commits — one screen/feature per commit.

## Compact instructions

When compacting, preserve: the data model, the projection formula, current phase/TODO state, and any schema or architecture decisions. Preserve any tree/parent-child logic and the delete-safety rule — this is foundational to category management. Drop verbose tool output and exploratory back-and-forth.

## Build phases & TODO

Work one phase per session; `/clear` between phases. Mark items done as you go.

**Phase 1 — MVP**

- [x] Scaffold Expo + TS app, tab navigator, expo-sqlite + migrations, seed default categories
- [x] Add Expense screen (fast; compute amount_base on save)
- [x] History screen with running totals
- [x] Delete an expense from History (deleteExpense helper + confirm step)
- [x] Edit an expense (reuse Add Expense form in edit mode + updateExpense helper)
- [x] Summary screen with simple projection

**Phase 2 — sticky**

- [x] Sub-categories: schema v2 migration + management screen (list / add / edit / delete with block rule)
- [ ] Category picker in Add Expense — two-level selection (parent → child)
- [ ] Over-budget indicators in Summary + per-category budget progress
- [ ] Recurring expenses + auto-generate on launch + recurring-aware projection
- [ ] Charts (category breakdown, spend-over-time, projection vs budget)
- [ ] CSV export

**Phase 3 — later**

- [ ] Expo web build + responsive polish
- [ ] Optional Supabase sync + auth
- [ ] Optional live exchange rate; receipt photo; income/net-savings

## Current status

**Phase 2 in progress.** Expo SDK 54 / React Native 0.81.5 / expo-sqlite 16.0.10. Phase 1 complete. Sub-categories schema (v2: `ALTER TABLE categories ADD COLUMN parent_id`) and Categories management screen shipped (`app/categories/`). Shared form: `components/CategoryForm.tsx`. New DB helpers: `getCategoryTree`, `getCategoryById`, `getTopCategories`, `getSubcategories`, `addCategory`, `updateCategory`, `deleteCategory` (throws `has_children` / `has_expenses` if blocked). Settings tab is now a real hub linking to Categories. Next: two-level category picker in Add Expense.

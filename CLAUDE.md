# SpendTrack — Project Memory

Personal daily-spending tracker with month-end projection. Mobile-first, web later.
This file is the single source of truth — keep it current as the project evolves.

## Stack

- **Expo (React Native + TypeScript)** — one codebase → iOS, Android, web. Mobile is the priority.
- **expo-sqlite** — local-first, on-device. No backend, no login in v1. Works offline.
- **expo-router** — file-based routing; tabs under `app/(tabs)/`, modals as stack screens.
- Tab navigation: Add · History · Summary · Settings.
- Sync (Supabase) is deferred; do not add until explicitly requested. The data model below is sync-ready.
- **Versions:** confirm against package.json and keep this accurate — run `npx expo --version`. (Notes showed both SDK 54 and 56 — verify and fix here.)

## Core rule

Logging must be near-frictionless — the Add Expense flow should take ~3 taps max. Optimize it above everything else.

## Currency

- Multi-currency: **TND** + **EUR**. Base currency = TND.
- Each expense stored in its original currency AND as `amount_base` (converted at entry time using the stored rate, rounded to 2 decimals).
- Never recompute `amount_base` from a live rate later — historical totals must stay fixed.
- EUR→TND rate is stored in settings and user-editable (seed value is a placeholder — correct it in Settings). Live fetch is a future option only.

## Data model (SQLite)

**categories**: id (pk), name, icon (nullable), color (hex), monthly_budget (real, nullable, base currency), parent_id (integer, nullable, FK → categories.id).
- `parent_id` NULL = top-level. Sub-categories point at their parent.
- Schema supports arbitrary depth; the v1 UI exposes two levels only.
- Reparenting is not supported in v1 (parent is fixed at creation) — future work if needed.
- **Delete rule:** deletion is blocked if the category has children OR has expenses; user must clean up manually first. No cascade, no reassignment, no silent data loss. `deleteCategory` throws `'has_children'` / `'has_expenses'` so the UI can show the right message.

**expenses**: id (pk), amount (real, original currency), currency ('TND'|'EUR'), amount_base (real, rounded 2dp), category_id (fk → **leaf** category — a sub-category if one was chosen, otherwise a top-level category), note (nullable), date (ISO `YYYY-MM-DD`, zero-padded), created_at (ISO timestamp, set by addExpense), recurring_id (fk, nullable).

**recurring**: id (pk), amount, currency, category_id (fk), note (nullable), frequency ('monthly'|'weekly'), day_of_month (int, nullable), day_of_week (int, nullable), start_date (ISO), end_date (ISO, nullable), last_generated_date (ISO, nullable). *(Table exists in schema; recurring feature not yet built.)*

**settings** (single row, pinned `id = 1` with `CHECK(id = 1)`): base_currency (default 'TND'), eur_to_tnd_rate (real), month_start_day (int, default 1), language (text, nullable; NULL = follow device locale, 'en'|'fr'|'ar' = user override).

### Schema migrations

- **v1** — initial schema: categories, settings, recurring, expenses. PRAGMA `user_version` gates migrations.
- **v2** — `ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id)` (non-destructive; existing rows become top-level).
- **v3** — `ALTER TABLE settings ADD COLUMN language TEXT` (non-destructive; existing row gets NULL = device locale).

## Budget month window

Both History and Summary use a single shared helper — `lib/budgetMonth.ts` — so they can never disagree on the window. Do not duplicate this logic.
- `getMonthStart(monthStartDay)` → `YYYY-MM-DD` start of the current budget period, clamping `monthStartDay` to the last real day of the target month (`new Date(y, m+1, 0).getDate()`) so values like 29–31 don't roll into the next month.
- `getBudgetMonthBounds(monthStartDay)` → `{ monthStart, daysElapsed, daysInMonth }`. Dates constructed at local midnight; day counts via ms-subtraction / 86,400,000. `daysElapsed` is inclusive (today = day 1). `daysInMonth` is the length of the budget period (start → next period start), not a calendar month. (DST note: ms-division assumes 24h days; fine for non-DST locales like Tunisia.)

## Projection logic

```
days_elapsed   = today - month_start + 1   (inclusive; guard /0 on day 1)
days_in_month  = days in current budget period
days_remaining = days_in_month - days_elapsed

variable_spent = sum(amount_base) of non-recurring expenses this month
avg_daily_var  = variable_spent / days_elapsed
projected_var  = variable_spent + avg_daily_var * days_remaining

remaining_recurring = recurring entries due later this month, not yet generated
projected_month_total = projected_var + remaining_recurring
```
**Currently shipped:** the simple form `spent / days_elapsed * days_in_month`, labelled "at this pace." Upgrade to the recurring-aware form above when recurring expenses are built.

## Screens & key files

1. **Add Expense** (hero) — `app/(tabs)/index.tsx` is a thin wrapper around `components/ExpenseForm.tsx` (shared create/edit form). On-screen numeric keypad (`components/Keypad.tsx`, emits raw keys; amount-input rules live in the form), TND/EUR toggle, two-level category picker with a recents row, optional collapsible note, date defaulting to today. On save: compute `amount_base` (round 2dp), insert via `addExpense`; in create mode reset-in-place and stay; in edit mode call `onSave()` and pop.
   - **Category picker:** state machine `recents → parents → children`. Recents = most-used leaf categories (last 30 expenses) as one-tap chips; "More ›" opens the two-step parent→child browse. Empty recents skips straight to parents. Selecting a childless parent sets it directly as the leaf. Collapsed label shows "Parent → Child"; "Change" reopens.
2. **History** — `app/(tabs)/history.tsx`. `SectionList` grouped by day; section header = date + day total; rows show category dot + name + note + **original** amount/currency. MTD total card on top. Reloads on focus (`useFocusEffect`). Tap row → edit (`app/expense/[id].tsx`); long-press → delete confirm.
3. **Summary** — `app/(tabs)/summary.tsx`. Total-spent + projection cards (unchanged by category logic). Category breakdown **rolls sub-categories up under their top-level parent**: one bar per parent (share of month), expandable to sub-rows (share of parent). When a parent has both direct and sub expenses, a synthetic "(direct)" remainder row keeps sub-rows summing to the parent total. Empty-month "No expenses" card. CSS-width bars, no chart library.
4. **Categories & Budgets** — `app/categories/index.tsx` (tree list: parents + indented subs, "+ sub" per parent), `app/categories/new.tsx` (create; optional `?parentId=`), `app/categories/[id].tsx` (edit). Shared `components/CategoryForm.tsx`. Reached from the Settings hub.
5. **Recurring** — manage recurring expenses; generate due entries on launch. *(Not yet built.)*
6. **Settings** — `app/(tabs)/settings.tsx`, a hub. Links to Categories & Budgets; placeholder rows for base currency, EUR→TND rate, month start day, CSV export.

## DB layer (`db/index.ts`)

All SQL lives here; screens never write raw SQL. Key helpers shipped:
- Expenses: `addExpense` (stamps created_at), `updateExpense`, `getExpense` (→ `Expense | null`), `deleteExpense`, `getExpensesForMonth(monthStartISO)` (JOIN → `ExpenseRow[]`).
- Categories: `getCategories`, `getCategoryById`, `getTopCategories`, `getSubcategories`, `getCategoryTree` (→ `CategoryTree[]`), `getRecentCategories(limit, days)`, `addCategory`, `updateCategory` (no reparenting), `deleteCategory` (throws on block).
- Settings: `getSettings`, `updateSettings`. Migrations + seed run on app launch (`app/_layout.tsx`); seed is idempotent (`INSERT OR IGNORE`).

## Internationalisation (`lib/i18n.ts`)

- Packages: `i18next`, `react-i18next`, `expo-localization`.
- Supported locales: `'en' | 'fr' | 'ar'`. Strings live in `locales/{en,fr,ar}.json`.
- Key namespace convention: `screen.key` (e.g. `settings.manage`). Use this for all future screens.
- `initI18n(overrideLanguage?)` is called once in `app/_layout.tsx` after migrations, before `setReady(true)`. It reads `settings.language`; if NULL it falls back to `expo-localization` device detection → `'en'` if unsupported.
- `<I18nextProvider>` wraps `<Stack>` in the root layout; screens use `useTranslation()`.
- Arabic renders LTR until the RTL layout pass (deferred). Strings load correctly; layout is expected to be wrong for now.
- **Known blocker — language picker "Follow device":** `updateSettings({ language: null })` silently no-ops because `COALESCE(null, language)` keeps the old value. When building the language picker, add a dedicated `clearLanguage()` helper (`UPDATE settings SET language = NULL WHERE id = 1`) rather than routing through `updateSettings`.

## Conventions

- TypeScript strict. Functional components + hooks.
- Keep DB access in `db/`; screens never write raw SQL inline.
- Schema changes go through the migrations file with a `user_version` bump; non-destructive.
- Shared logic lives in one place (e.g. `lib/budgetMonth.ts`, `lib/i18n.ts`, shared form components) — never duplicate.
- Dates always zero-padded `YYYY-MM-DD` so string comparisons in WHERE clauses are reliable.
- Small, reviewable commits — one screen/feature per commit. Commit + push after each item (off-device backup).

## Compact instructions

When compacting, preserve: the data model, the projection formula, the budget-month window logic, current phase/TODO state, and all schema/architecture decisions. Preserve the category tree/parent-child logic, the delete-safety rule, the leaf-category rule for expenses, and the Summary rollup with the synthetic "(direct)" row — these are foundational. Drop verbose tool output and exploratory back-and-forth.

## Build phases & TODO

Work one item per session; `/clear` between items. Mark items done as you go.

**Phase 1 — MVP** ✅ complete
- [x] Scaffold Expo + TS app, tab navigator, expo-sqlite + migrations, seed default categories
- [x] Add Expense screen (fast; compute amount_base on save)
- [x] History screen with running totals
- [x] Delete an expense from History (deleteExpense + confirm)
- [x] Edit an expense (shared ExpenseForm in edit mode + updateExpense)
- [x] Summary screen with simple projection

**Phase 2 — sticky**
- [x] Sub-categories: schema v2 migration + management screen (list / add / edit / delete with block rule)
- [x] Category picker in Add Expense — two-level selection (recents → parent → child)
- [x] Summary: roll sub-categories up under parent, expand-to-sub with synthetic "(direct)" remainder row
- [ ] Over-budget indicators in Summary + per-category budget progress
- [ ] Recurring expenses + auto-generate on launch + recurring-aware projection
- [ ] Charts (category breakdown, spend-over-time, projection vs budget)
- [ ] CSV export

**Phase 3 — later**
- [ ] Expo web build + responsive polish
- [ ] Optional Supabase sync + auth
- [ ] Optional live exchange rate; receipt photo; income/net-savings

## Current status

**Phase 2 in progress. Phase 1 complete.** The sub-category feature is complete end to end: schema (v2 `parent_id`), Categories management (`app/categories/` + `components/CategoryForm.tsx`), two-level Add Expense picker with a recents row (`components/ExpenseForm.tsx`, `getRecentCategories`), and the Summary parent-rollup with expand-to-sub and the synthetic "(direct)" remainder row. Budget-month window shared via `lib/budgetMonth.ts`.

i18n plumbing is complete: v3 migration (`settings.language`), `lib/i18n.ts`, locales for EN/FR/AR, `I18nextProvider` at root, Settings screen converted as POC. RTL layout and mass string extraction are deferred.

Remaining Phase 2: per-category budgets / over-budget indicators, recurring expenses (also upgrades the projection to recurring-aware), charts, CSV export, language picker in Settings.

**Next item: TBD** — using the app on real spending for a stretch before picking, so the priority order reflects what actually annoys in daily use (likely recurring vs. budgets).

*(Housekeeping: verify the Expo SDK version and fix the Stack section — notes showed both 54 and 56.)*

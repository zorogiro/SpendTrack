import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getExpensesForMonth, getSettings } from '../../db';
import { getBudgetMonthBounds } from '../../lib/budgetMonth';

// ── Types ─────────────────────────────────────────────────────────────────────

type CatTotal = {
  category_id: number;
  category_name: string;
  category_color: string;
  total: number;
  share: number; // 0–1; always 0 when totalSpent === 0
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n: number): string {
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const [totalSpent,    setTotalSpent]    = useState(0);
  const [projected,     setProjected]     = useState(0);
  const [cats,          setCats]          = useState<CatTotal[]>([]);
  const [bootstrapped,  setBootstrapped]  = useState(false);

  const load = useCallback(async () => {
    const settings = await getSettings();
    const { monthStart, daysElapsed, daysInMonth } = getBudgetMonthBounds(settings.month_start_day);
    const rows = await getExpensesForMonth(monthStart);

    const spent = rows.reduce((s, e) => s + e.amount_base, 0);

    // Simple projection: spent / days_elapsed * days_in_month
    const proj = daysElapsed > 0 ? (spent / daysElapsed) * daysInMonth : spent;

    // Group by category
    const map = new Map<number, Omit<CatTotal, 'share'>>();
    for (const e of rows) {
      const existing = map.get(e.category_id);
      if (existing) {
        existing.total += e.amount_base;
      } else {
        map.set(e.category_id, {
          category_id:    e.category_id,
          category_name:  e.category_name,
          category_color: e.category_color,
          total:          e.amount_base,
        });
      }
    }

    // Sort descending; guard: share = 0 when spent === 0 to avoid NaN / Infinity
    const grouped: CatTotal[] = [...map.values()]
      .sort((a, b) => b.total - a.total)
      .map(c => ({ ...c, share: spent > 0 ? c.total / spent : 0 }));

    setTotalSpent(spent);
    setProjected(proj);
    setCats(grouped);
    setBootstrapped(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!bootstrapped) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Totals card ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SPENT THIS MONTH</Text>
          <Text style={styles.totalAmt}>{fmtAmt(totalSpent)} TND</Text>

          <View style={styles.divider} />

          <Text style={styles.projLabel}>Projected · at this pace</Text>
          <Text style={styles.projAmt}>{fmtAmt(projected)} TND</Text>
        </View>

        {/* ── Category breakdown ──────────────────────────────────────────── */}
        {cats.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>No expenses this month</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>BY CATEGORY</Text>
            {cats.map((cat, i) => (
              <View key={cat.category_id} style={[styles.catRow, i > 0 && styles.catBorder]}>
                <View style={styles.catMeta}>
                  <View style={[styles.dot, { backgroundColor: cat.category_color }]} />
                  <Text style={styles.catName} numberOfLines={1}>{cat.category_name}</Text>
                  <Text style={styles.catPct}>{Math.round(cat.share * 100)}%</Text>
                  <Text style={styles.catAmt}>{fmtAmt(cat.total)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(cat.share * 100).toFixed(1)}%`,
                        backgroundColor: cat.category_color,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f2f2f7' },
  scroll: { padding: 16, paddingBottom: 40 },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  muted:     { fontSize: 15, color: '#8e8e93' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 40, alignItems: 'center' },

  // Card shell
  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.6, marginBottom: 8 },

  // Totals
  totalAmt:  { fontSize: 38, fontWeight: '300', color: '#1c1c1e', letterSpacing: -1 },
  divider:   { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginVertical: 16 },
  projLabel: { fontSize: 12, color: '#8e8e93', marginBottom: 4 },
  projAmt:   { fontSize: 24, fontWeight: '400', color: '#1c1c1e' },

  // Category rows
  catRow:    { paddingVertical: 12 },
  catBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5ea' },
  catMeta:   { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  dot:       { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  catName:   { flex: 1, fontSize: 14, fontWeight: '500', color: '#1c1c1e' },
  catPct:    { fontSize: 13, color: '#8e8e93', marginRight: 10 },
  catAmt:    { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },

  // Bar
  barTrack:  { height: 4, backgroundColor: '#f2f2f7', borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: 4, borderRadius: 2 },
});

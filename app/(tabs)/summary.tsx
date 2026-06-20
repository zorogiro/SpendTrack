import { useCallback, useState } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getCategoryTree, getExpensesForMonth, getSettings } from '../../db';
import { getBudgetMonthBounds } from '../../lib/budgetMonth';
import { fmtTND } from '../../lib/format';
import type { CategoryTree, ExpenseRow } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubCatTotal = {
  key: string;
  category_name: string;
  category_color: string;
  total: number;
  shareOfParent: number; // 0–1; % label and bar width in expanded view
};

type ParentTotal = {
  category_id: number;
  category_name: string;
  category_color: string;
  total: number;
  shareOfMonth: number; // 0–1; % label and bar width in parent row
  subs: SubCatTotal[];  // non-empty only when sub-category expenses exist
};

// ── Rollup ────────────────────────────────────────────────────────────────────

function buildRollup(rows: ExpenseRow[], tree: CategoryTree[]): ParentTotal[] {
  // Map every category id (top-level or child) → its top-level CategoryTree node
  const parentLookup = new Map<number, CategoryTree>();
  const catById = new Map<number, { name: string; color: string }>();

  for (const node of tree) {
    parentLookup.set(node.id, node);
    catById.set(node.id, { name: node.name, color: node.color });
    for (const child of node.children) {
      parentLookup.set(child.id, node);
      catById.set(child.id, { name: child.name, color: child.color });
    }
  }

  type Agg = { directTotal: number; total: number; subMap: Map<number, number> };
  const aggMap = new Map<number, Agg>();

  for (const e of rows) {
    const parent = parentLookup.get(e.category_id);
    if (!parent) continue; // orphaned category — skip

    const agg = aggMap.get(parent.id) ?? { directTotal: 0, total: 0, subMap: new Map() };
    agg.total += e.amount_base;

    if (e.category_id === parent.id) {
      agg.directTotal += e.amount_base;
    } else {
      agg.subMap.set(e.category_id, (agg.subMap.get(e.category_id) ?? 0) + e.amount_base);
    }

    aggMap.set(parent.id, agg);
  }

  const monthTotal = [...aggMap.values()].reduce((s, a) => s + a.total, 0);

  return [...aggMap.entries()]
    .map(([parentId, agg]) => {
      const parentCat = catById.get(parentId) ?? { name: '?', color: '#8e8e93' };

      const subs: SubCatTotal[] = [...agg.subMap.entries()]
        .map(([subId, total]) => {
          const sub = catById.get(subId) ?? { name: '?', color: '#8e8e93' };
          return {
            key: String(subId),
            category_name: sub.name,
            category_color: sub.color,
            total,
            shareOfParent: agg.total > 0 ? total / agg.total : 0,
          };
        })
        .sort((a, b) => b.total - a.total);

      // When direct expenses coexist with sub-category expenses, add a synthetic
      // remainder row so the expanded sub-rows always sum to the parent total.
      if (agg.directTotal > 0 && agg.subMap.size > 0) {
        const synth: SubCatTotal = {
          key: `${parentId}-direct`,
          category_name: `${parentCat.name} (direct)`,
          category_color: parentCat.color,
          total: agg.directTotal,
          shareOfParent: agg.total > 0 ? agg.directTotal / agg.total : 0,
        };
        const insertAt = subs.findIndex(s => s.total < synth.total);
        if (insertAt === -1) subs.push(synth); else subs.splice(insertAt, 0, synth);
      }

      return {
        category_id: parentId,
        category_name: parentCat.name,
        category_color: parentCat.color,
        total: agg.total,
        shareOfMonth: monthTotal > 0 ? agg.total / monthTotal : 0,
        subs,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const { t } = useTranslation();
  const [totalSpent,   setTotalSpent]   = useState(0);
  const [projected,    setProjected]    = useState(0);
  const [parents,      setParents]      = useState<ParentTotal[]>([]);
  const [expanded,     setExpanded]     = useState<Set<number>>(new Set());
  const [bootstrapped, setBootstrapped] = useState(false);

  const toggle = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const [settings, tree] = await Promise.all([getSettings(), getCategoryTree()]);
    const { monthStart, daysElapsed, daysInMonth } = getBudgetMonthBounds(settings.month_start_day);
    const rows = await getExpensesForMonth(monthStart);

    const spent = rows.reduce((s, e) => s + e.amount_base, 0);
    const proj  = daysElapsed > 0 ? (spent / daysElapsed) * daysInMonth : spent;

    setTotalSpent(spent);
    setProjected(proj);
    setParents(buildRollup(rows, tree));
    setBootstrapped(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!bootstrapped) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('summary.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Totals card ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('summary.spent_this_month')}</Text>
          <Text style={styles.totalAmt}>{fmtTND(totalSpent)} TND</Text>

          <View style={styles.divider} />

          <Text style={styles.projLabel}>{t('summary.projected_label')}</Text>
          <Text style={styles.projAmt}>{fmtTND(projected)} TND</Text>
        </View>

        {/* ── Category breakdown ──────────────────────────────────────────── */}
        {parents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>{t('summary.empty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('summary.by_category')}</Text>
            {parents.map((cat, i) => {
              const isExpanded  = expanded.has(cat.category_id);
              const expandable  = cat.subs.length > 0;

              return (
                <View key={cat.category_id} style={[styles.catRow, i > 0 && styles.catBorder]}>

                  {/* Parent row */}
                  <Pressable
                    onPress={expandable ? () => toggle(cat.category_id) : undefined}
                    style={({ pressed }) => [styles.catMeta, pressed && expandable && styles.pressed]}
                  >
                    <View style={[styles.dot, { backgroundColor: cat.category_color }]} />
                    <Text style={styles.catName} numberOfLines={1}>{cat.category_name}</Text>
                    <Text style={styles.catPct}>{Math.round(cat.shareOfMonth * 100)}%</Text>
                    <Text style={styles.catAmt}>{fmtTND(cat.total)}</Text>
                    {expandable ? (
                      <Ionicons
                        name={isExpanded ? 'chevron-down' : (I18nManager.isRTL ? 'chevron-back' : 'chevron-forward')}
                        size={16}
                        color="#8e8e93"
                        style={styles.chevron}
                      />
                    ) : (
                      <View style={styles.chevronSlot} />
                    )}
                  </Pressable>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${(cat.shareOfMonth * 100).toFixed(1)}%`, backgroundColor: cat.category_color },
                      ]}
                    />
                  </View>

                  {/* Sub-category breakdown */}
                  {isExpanded && (
                    <View style={styles.subsWrap}>
                      <Text style={styles.subHeader}>{t('summary.pct_of_parent', { parent: cat.category_name.toUpperCase() })}</Text>
                      {cat.subs.map(sub => (
                        <View key={sub.key} style={styles.subRow}>
                          <View style={styles.catMeta}>
                            <View style={[styles.subDot, { backgroundColor: sub.category_color }]} />
                            <Text style={styles.subName} numberOfLines={1}>
                              {sub.key.endsWith('-direct')
                                ? t('summary.direct_label', { name: cat.category_name })
                                : sub.category_name}
                            </Text>
                            <Text style={styles.catPct}>{Math.round(sub.shareOfParent * 100)}%</Text>
                            <Text style={styles.catAmt}>{fmtTND(sub.total)}</Text>
                            <View style={styles.chevronSlot} />
                          </View>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                { width: `${(sub.shareOfParent * 100).toFixed(1)}%`, backgroundColor: sub.category_color },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
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

  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.6, marginBottom: 8 },

  totalAmt:  { fontSize: 38, fontWeight: '300', color: '#1c1c1e', letterSpacing: -1 },
  divider:   { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginVertical: 16 },
  projLabel: { fontSize: 12, color: '#8e8e93', marginBottom: 4 },
  projAmt:   { fontSize: 24, fontWeight: '400', color: '#1c1c1e' },

  catRow:    { paddingVertical: 12 },
  catBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5ea' },
  catMeta:   { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  pressed:   { opacity: 0.6 },
  dot:       { width: 10, height: 10, borderRadius: 5, marginEnd: 8 },
  catName:   { flex: 1, fontSize: 14, fontWeight: '500', color: '#1c1c1e' },
  catPct:    { fontSize: 13, color: '#8e8e93', marginEnd: 10 },
  catAmt:    { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  chevron:     { marginStart: 6 },
  chevronSlot: { width: 22 }, // keeps amt column aligned on non-expandable rows

  barTrack:  { height: 4, backgroundColor: '#f2f2f7', borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: 4, borderRadius: 2 },

  subsWrap:  { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5ea' },
  subHeader: { fontSize: 10, fontWeight: '600', color: '#aeaeb2', letterSpacing: 0.5, marginBottom: 2, paddingStart: 18 },
  subRow:    { paddingStart: 18, paddingVertical: 6 },
  subDot:    { width: 8, height: 8, borderRadius: 4, marginEnd: 8 },
  subName:   { flex: 1, fontSize: 13, color: '#3c3c43' },
});

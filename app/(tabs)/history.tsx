import { useCallback, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { deleteExpense, getExpensesForMonth, getSettings } from '../../db';
import { getMonthStart } from '../../lib/budgetMonth';
import { fmtTND, formatDateLabel } from '../../lib/format';
import type { ExpenseRow } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = { date: string; dayTotal: number; data: ExpenseRow[] };

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const { t } = useTranslation();
  const [sections, setSections]         = useState<Section[]>([]);
  const [mtdTotal, setMtdTotal]         = useState(0);
  const [bootstrapped, setBootstrapped] = useState(false);

  const load = useCallback(async () => {
    const settings = await getSettings();
    const monthStart = getMonthStart(settings.month_start_day);
    const rows = await getExpensesForMonth(monthStart);

    setMtdTotal(rows.reduce((s, e) => s + e.amount_base, 0));

    // Group by date — rows already arrive date DESC, created_at DESC
    const map = new Map<string, ExpenseRow[]>();
    for (const e of rows) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }

    const grouped: Section[] = [];
    for (const [date, data] of map) {
      grouped.push({ date, dayTotal: data.reduce((s, e) => s + e.amount_base, 0), data });
    }
    setSections(grouped);
    setBootstrapped(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = useCallback((item: ExpenseRow) => {
    Alert.alert(
      t('history.delete_title'),
      t('history.delete_message', { amount: fmtTND(item.amount), currency: item.currency, category: item.category_name }),
      [
        { text: t('history.delete_cancel'), style: 'cancel' },
        {
          text: t('history.delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(item.id);
            load();
          },
        },
      ],
    );
  }, [load, t]);

  if (!bootstrapped) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('history.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          <View style={styles.mtdCard}>
            <Text style={styles.mtdLabel}>{t('history.this_month')}</Text>
            <Text style={styles.mtdAmount}>{fmtTND(mtdTotal)} TND</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{formatDateLabel(section.date)}</Text>
            <Text style={styles.sectionTotal}>{fmtTND(section.dayTotal)} TND</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const isFirst = index === 0;
          const isLast  = index === section.data.length - 1;
          return (
            <Pressable
              onPress={() => router.push(`/expense/${item.id}`)}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={400}
              style={({ pressed }) => [
                styles.row,
                isFirst && styles.rowFirst,
                isLast  && styles.rowLast,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={[styles.dot, { backgroundColor: item.category_color }]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowCat} numberOfLines={1}>
                  {item.category_icon ? `${item.category_icon} ` : ''}{item.category_name}
                </Text>
                {item.note ? (
                  <Text style={styles.rowNote} numberOfLines={1}>{item.note}</Text>
                ) : null}
              </View>
              <Text style={styles.rowAmt}>{fmtTND(item.amount)} {item.currency}</Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>{t('history.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f2f2f7' },
  listContent:    { paddingBottom: 32 },
  emptyContainer: { flex: 1 },

  // MTD card
  mtdCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  mtdLabel:  { fontSize: 11, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.6 },
  mtdAmount: { fontSize: 38, fontWeight: '300', color: '#1c1c1e', letterSpacing: -1, marginTop: 4 },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionDate:  { fontSize: 12, fontWeight: '700', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTotal: { fontSize: 12, fontWeight: '500', color: '#8e8e93' },

  // Expense rows — grouped card effect
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginHorizontal: 16,
  },
  rowFirst:   { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  rowLast:    { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  rowPressed: { backgroundColor: '#f2f2f7' },

  dot:     { width: 10, height: 10, borderRadius: 5, marginEnd: 12 },
  rowBody: { flex: 1, marginEnd: 10 },
  rowCat:  { fontSize: 15, fontWeight: '500', color: '#1c1c1e' },
  rowNote: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  rowAmt:  { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e5ea',
    marginStart: 38,
    marginHorizontal: 16,
  },

  // Empty / loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted:  { fontSize: 15, color: '#8e8e93' },
});

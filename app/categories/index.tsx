import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, I18nManager, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { deleteCategory, getCategoryTree } from '../../db';
import type { Category, CategoryTree } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ListItem =
  | { kind: 'parent'; tree: CategoryTree }
  | { kind: 'child';  cat: Category };

function buildList(trees: CategoryTree[], expanded: Set<number>): ListItem[] {
  const items: ListItem[] = [];
  for (const tree of trees) {
    items.push({ kind: 'parent', tree });
    if (expanded.has(tree.id)) {
      for (const child of tree.children) {
        items.push({ kind: 'child', cat: child });
      }
    }
  }
  return items;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const [trees,    setTrees]    = useState<CategoryTree[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const didInitExpanded = useRef(false);

  const toggle = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const data = await getCategoryTree();
    setTrees(data);
    if (!didInitExpanded.current) {
      didInitExpanded.current = true;
      setExpanded(new Set(data.filter(t => t.children.length > 0).map(t => t.id)));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items = useMemo(() => buildList(trees, expanded), [trees, expanded]);

  const handleDelete = useCallback((id: number, name: string) => {
    Alert.alert(t('categories.delete_title'), name, [
      { text: t('categories.delete_cancel'), style: 'cancel' },
      {
        text: t('categories.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(id);
            load();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '';
            Alert.alert(
              t('categories.cannot_delete_title'),
              msg === 'has_children'
                ? t('categories.block_has_children')
                : msg === 'has_expenses'
                  ? t('categories.block_has_expenses')
                  : t('categories.delete_error'),
            );
          }
        },
      },
    ]);
  }, [load, t]);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('categories.title'),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/categories/new')} hitSlop={12}>
              <Text style={styles.headerBtn}>＋</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={item =>
          item.kind === 'parent' ? `p-${item.tree.id}` : `c-${item.cat.id}`
        }
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const isParent = item.kind === 'parent';
          const topMargin = isParent && index > 0 ? 12 : 2;

          if (item.kind === 'parent') {
            const { tree } = item;
            const expandable = tree.children.length > 0;
            const isExpanded = expanded.has(tree.id);

            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { marginTop: topMargin },
                  pressed && styles.rowPressed,
                ]}
                onPress={() => router.push(`/categories/${tree.id}`)}
                onLongPress={() => handleDelete(tree.id, tree.name)}
                delayLongPress={400}
              >
                <View style={[styles.dot, { backgroundColor: tree.color }]} />
                <Text style={styles.parentName} numberOfLines={1}>
                  {tree.icon ? `${tree.icon} ` : ''}{tree.name}
                </Text>
                {tree.monthly_budget != null && (
                  <Text style={styles.budget}>{t('categories.budget_label', { amount: tree.monthly_budget.toFixed(0) })}</Text>
                )}
                <TouchableOpacity
                  style={styles.addSubBtn}
                  onPress={() => router.push(`/categories/new?parentId=${tree.id}`)}
                  hitSlop={8}
                >
                  <Text style={styles.addSubLabel}>{t('categories.add_sub')}</Text>
                </TouchableOpacity>
                {expandable ? (
                  <Pressable
                    onPress={() => toggle(tree.id)}
                    hitSlop={10}
                    style={styles.chevronBtn}
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : (I18nManager.isRTL ? 'chevron-back' : 'chevron-forward')}
                      size={18}
                      color="#8e8e93"
                    />
                  </Pressable>
                ) : (
                  <View style={styles.chevronSlot} />
                )}
              </Pressable>
            );
          }

          const { cat } = item;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                styles.childRow,
                { marginTop: topMargin },
                pressed && styles.rowPressed,
              ]}
              onPress={() => router.push(`/categories/${cat.id}`)}
              onLongPress={() => handleDelete(cat.id, cat.name)}
              delayLongPress={400}
            >
              <View style={[styles.dot, styles.childDot, { backgroundColor: cat.color }]} />
              <Text style={styles.childName} numberOfLines={1}>
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </Text>
              {cat.monthly_budget != null && (
                <Text style={styles.budget}>{t('categories.budget_label', { amount: cat.monthly_budget.toFixed(0) })}</Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('categories.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },
  list: { padding: 16, paddingBottom: 40 },

  headerBtn: { fontSize: 22, color: '#007aff', fontWeight: '300', paddingHorizontal: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: '#f0f0f5' },
  childRow:   { paddingStart: 36 },

  dot:      { width: 12, height: 12, borderRadius: 6, marginEnd: 12 },
  childDot: { width: 8, height: 8, borderRadius: 4 },

  parentName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1c1c1e' },
  childName:  { flex: 1, fontSize: 15, fontWeight: '400', color: '#3a3a3c' },
  budget:     { fontSize: 13, color: '#8e8e93', marginEnd: 8 },

  addSubBtn:   { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#f2f2f7', borderRadius: 10 },
  addSubLabel: { fontSize: 12, fontWeight: '600', color: '#007aff' },

  chevronBtn:  { marginStart: 10, padding: 4 },
  chevronSlot: { width: 26, marginStart: 10 }, // keeps row height & alignment uniform

  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15, color: '#8e8e93', textAlign: 'center', lineHeight: 24 },
});

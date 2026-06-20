import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Keypad from './Keypad';
import { addExpense, getCategoryTree, getRecentCategories, getSettings, updateExpense } from '../db';
import type { Category, CategoryTree, Currency } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExpenseInit {
  id: number;
  amount: number;
  currency: Currency;
  category_id: number;
  note: string | null;
  date: string;
}

interface Props {
  initial?: ExpenseInit;
  onSave?: () => void;
}

type PickerStage = 'recents' | 'parents' | 'children';

// ── Pure helpers ──────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return localISO(new Date());
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

function formatDisplayDate(iso: string): string {
  if (iso === todayISO()) return 'Today';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`;
}

function formatAmount(s: string): string {
  const [int, dec] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

// Null-safe: returns null when tree is empty or id is not found (clarification 2).
function findLeaf(
  tree: CategoryTree[],
  id: number | null,
): { cat: Category; parent?: CategoryTree } | null {
  if (id === null) return null;
  for (const p of tree) {
    if (p.id === id) return { cat: p };
    for (const c of p.children) {
      if (c.id === id) return { cat: c, parent: p };
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpenseForm({ initial, onSave }: Props) {
  const isEdit = initial !== undefined;

  const [amountStr, setAmountStr]           = useState(isEdit ? String(initial!.amount) : '0');
  const [currency, setCurrency]             = useState<Currency>(isEdit ? initial!.currency : 'TND');
  const [categoryId, setCategoryId]         = useState<number | null>(isEdit ? initial!.category_id : null);
  const [note, setNote]                     = useState(isEdit ? (initial!.note ?? '') : '');
  const [noteVisible, setNoteVisible]       = useState(isEdit ? !!(initial!.note) : false);
  const [date, setDate]                     = useState(isEdit ? initial!.date : todayISO());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rate, setRate]                     = useState(3.40);
  const [saving, setSaving]                 = useState(false);

  // Picker
  const [recents,      setRecents]      = useState<Category[]>([]);
  const [tree,         setTree]         = useState<CategoryTree[]>([]);
  const [showPicker,   setShowPicker]   = useState(!isEdit);   // open on create, closed on edit
  const [pickerStage,  setPickerStage]  = useState<PickerStage>('recents');
  const [browseParent, setBrowseParent] = useState<CategoryTree | null>(null);

  const noteRef = useRef<TextInput>(null);

  useEffect(() => {
    Promise.all([getCategoryTree(), getRecentCategories(6, 30), getSettings()]).then(
      ([treeData, recentData, s]) => {
        setTree(treeData);
        setRecents(recentData);
        setRate(s.eur_to_tnd_rate);
      },
    );
  }, []);

  // Clarification 1: when stage='recents' but recents are empty, render parents layout.
  const effectiveStage: PickerStage =
    pickerStage === 'recents' && recents.length === 0 ? 'parents' : pickerStage;

  // Pre-compute which parent IDs have children (used for the › indicator).
  const parentIdsWithChildren = new Set(tree.filter(t => t.children.length > 0).map(t => t.id));

  // Chip data varies by stage; CategoryTree extends Category so the cast is safe.
  const chipData = (
    effectiveStage === 'children' && browseParent ? browseParent.children :
    effectiveStage === 'parents'                  ? tree                  :
                                                    recents
  ) as Category[];

  function selectCategory(id: number) {
    setCategoryId(id);
    setShowPicker(false);
    setPickerStage('recents');
    setBrowseParent(null);
  }

  function closePicker() {                   // closes without changing categoryId (clarification 3)
    setShowPicker(false);
    setPickerStage('recents');
    setBrowseParent(null);
  }

  function handleChipPress(item: Category) {
    if (effectiveStage === 'parents') {
      if (parentIdsWithChildren.has(item.id)) {
        setBrowseParent(tree.find(t => t.id === item.id) ?? null);
        setPickerStage('children');
      } else {
        selectCategory(item.id);
      }
    } else {
      // 'recents' or 'children' — tap = select
      selectCategory(item.id);
    }
  }

  const handleKey = useCallback((key: string) => {
    setAmountStr(s => {
      if (key === '⌫') return s.length <= 1 ? '0' : s.slice(0, -1);
      if (key === '.') return s.includes('.') ? s : s + '.';
      if (s === '0')  return key;
      const dot = s.indexOf('.');
      if (dot !== -1 && s.length - dot > 2) return s;
      return s + key;
    });
  }, []);

  async function handleSave() {
    const amount = parseFloat(amountStr);
    if (!(amount > 0) || categoryId === null) return;
    setSaving(true);
    try {
      const raw         = currency === 'EUR' ? amount * rate : amount;
      const amount_base = Math.round(raw * 100) / 100;
      const payload     = { amount, currency, amount_base, category_id: categoryId, note: note.trim() || null, date };

      if (isEdit) {
        await updateExpense(initial!.id, payload);
      } else {
        await addExpense(payload);
        // Reset only in create mode so the next entry starts fresh (clarification 4)
        setAmountStr('0');
        setCategoryId(null);
        setNote('');
        setNoteVisible(false);
        setShowPicker(true);
        setPickerStage('recents');
        setBrowseParent(null);
      }
      onSave?.();
    } finally {
      setSaving(false);
    }
  }

  const canSave = parseFloat(amountStr) > 0 && categoryId !== null && !saving;

  // Derive selected category label for the collapsed row.
  const found = findLeaf(tree, categoryId);
  const selectedLabel = found
    ? (found.parent ? `${found.parent.name} → ${found.cat.name}` : found.cat.name)
    : '…';  // placeholder while tree loads; never crashes (clarification 2)

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* Amount display */}
        <View style={styles.amountSection}>
          <View style={styles.currencyRow}>
            {(['TND', 'EUR'] as const).map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.currencyBtn, currency === c && styles.currencyBtnOn]}
                onPress={() => setCurrency(c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.currencyLabel, currency === c && styles.currencyLabelOn]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.amountText} adjustsFontSizeToFit numberOfLines={1}>
            {formatAmount(amountStr)}
          </Text>
        </View>

        {/* ── Category picker ────────────────────────────────────────────────── */}
        {categoryId !== null && !showPicker ? (

          // Collapsed: show selected label + Change link
          <View style={styles.selectedRow}>
            {found && <View style={[styles.selDot, { backgroundColor: found.cat.color }]} />}
            <Text style={styles.selectedLabel} numberOfLines={1}>{selectedLabel}</Text>
            <TouchableOpacity onPress={() => setShowPicker(true)} hitSlop={10}>
              <Text style={styles.changeBtn}>Change</Text>
            </TouchableOpacity>
          </View>

        ) : (

          // Expanded picker
          <View style={styles.pickerSection}>

            {/* Breadcrumb — children stage only */}
            {effectiveStage === 'children' && browseParent && (
              <TouchableOpacity
                style={styles.breadcrumb}
                onPress={() => setPickerStage('parents')}
              >
                <Text style={styles.breadcrumbText}>← {browseParent.name}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.chipRow}>
              {/* Close — parents stage only (clarification 3) */}
              {effectiveStage === 'parents' && (
                <TouchableOpacity style={styles.sideBtn} onPress={closePicker} hitSlop={8}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              )}

              <FlatList
                horizontal
                style={{ flex: 1 }}
                data={chipData}
                keyExtractor={c => String(c.id)}
                contentContainerStyle={styles.chipList}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.chip, { backgroundColor: item.color }]}
                    onPress={() => handleChipPress(item)}
                    activeOpacity={0.7}
                  >
                    {item.icon ? <Text style={styles.chipIcon}>{item.icon}</Text> : null}
                    <Text style={styles.chipLabel}>{item.name}</Text>
                    {effectiveStage === 'parents' && parentIdsWithChildren.has(item.id) && (
                      <Text style={styles.chipArrow}>›</Text>
                    )}
                  </TouchableOpacity>
                )}
              />

              {/* More — recents stage only */}
              {effectiveStage === 'recents' && (
                <TouchableOpacity
                  style={styles.sideBtn}
                  onPress={() => setPickerStage('parents')}
                >
                  <Text style={styles.moreBtnText}>More ›</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        )}

        {/* Note + Date */}
        <View style={styles.metaRow}>
          {noteVisible ? (
            <TextInput
              ref={noteRef}
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note…"
              placeholderTextColor="#aaa"
              returnKeyType="done"
              onSubmitEditing={() => setNoteVisible(false)}
              blurOnSubmit
              autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setNoteVisible(true)}>
              <Text style={note.trim() ? styles.noteFilled : styles.notePrompt}>
                {note.trim() || '+ Add note'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateLabel}>{formatDisplayDate(date)}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={new Date(`${date}T12:00:00`)}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(localISO(selected));
            }}
          />
        )}

        {/* Keypad */}
        <View style={{ flex: 1 }}>
          <Keypad onKey={handleKey} />
        </View>

        {/* Save / Update */}
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnLabel}>{isEdit ? 'UPDATE' : 'SAVE'}</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  amountSection:   { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  currencyRow:     { flexDirection: 'row', gap: 6, marginBottom: 8 },
  currencyBtn:     { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: '#f2f2f7' },
  currencyBtnOn:   { backgroundColor: '#1c1c1e' },
  currencyLabel:   { fontSize: 13, fontWeight: '600', color: '#8e8e93' },
  currencyLabelOn: { color: '#fff' },
  amountText:      { fontSize: 64, fontWeight: '200', color: '#1c1c1e', textAlign: 'right', letterSpacing: -2 },

  // Collapsed selected row
  selectedRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, minHeight: 52 },
  selDot:        { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  selectedLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1c1c1e' },
  changeBtn:     { fontSize: 15, color: '#007aff', fontWeight: '500' },

  // Expanded picker
  pickerSection:  { },
  breadcrumb:     { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 2 },
  breadcrumbText: { fontSize: 13, fontWeight: '600', color: '#007aff' },
  chipRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  sideBtn:        { paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  closeBtnText:   { fontSize: 16, color: '#8e8e93' },
  moreBtnText:    { fontSize: 14, fontWeight: '600', color: '#007aff' },
  chipList:       { paddingHorizontal: 8, gap: 8 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  chipIcon:       { fontSize: 14 },
  chipLabel:      { fontSize: 14, fontWeight: '500', color: '#fff' },
  chipArrow:      { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
  },
  notePrompt: { fontSize: 15, color: '#aaa' },
  noteFilled: { fontSize: 15, color: '#3a3a3c' },
  noteInput:  { flex: 1, fontSize: 15, color: '#1c1c1e', marginRight: 16 },
  dateLabel:  { fontSize: 15, color: '#007aff', fontWeight: '500' },

  saveBtn: {
    height: 54,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#007aff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnOff:   { backgroundColor: '#c7c7cc' },
  saveBtnLabel: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 1 },
});

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
import Keypad from '../../components/Keypad';
import { addExpense, getCategories, getSettings } from '../../db';
import type { Category, Currency } from '../../types';

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

// Narrow no-break space as thousands separator (ISO 31-0)
function formatAmount(s: string): string {
  const [int, dec] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec !== undefined ? `${grouped}.${dec}` : grouped;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AddExpenseScreen() {
  const [amountStr, setAmountStr]           = useState('0');
  const [currency, setCurrency]             = useState<Currency>('TND');
  const [categoryId, setCategoryId]         = useState<number | null>(null);
  const [note, setNote]                     = useState('');
  const [noteVisible, setNoteVisible]       = useState(false);
  const [date, setDate]                     = useState(todayISO);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [rate, setRate]                     = useState(3.40);
  const [saving, setSaving]                 = useState(false);

  const noteRef = useRef<TextInput>(null);

  useEffect(() => {
    Promise.all([getCategories(), getSettings()]).then(([cats, s]) => {
      setCategories(cats);
      setRate(s.eur_to_tnd_rate);
    });
  }, []);

  // ── amountStr rules ─────────────────────────────────────────────────────────
  // Keypad emits the raw key; all input logic lives here.
  const handleKey = useCallback((key: string) => {
    setAmountStr(s => {
      if (key === '⌫') return s.length <= 1 ? '0' : s.slice(0, -1); // single digit → '0'
      if (key === '.') return s.includes('.') ? s : s + '.';          // reject second decimal
      if (s === '0')  return key;                                      // drop leading zero
      const dot = s.indexOf('.');
      if (dot !== -1 && s.length - dot > 2) return s;                 // cap at 2 decimal places
      return s + key;
    });
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    const amount = parseFloat(amountStr);
    if (!(amount > 0) || categoryId === null) return;
    setSaving(true);
    try {
      const raw         = currency === 'EUR' ? amount * rate : amount;
      const amount_base = Math.round(raw * 100) / 100;
      await addExpense({
        amount,
        currency,
        amount_base,
        category_id: categoryId,
        note: note.trim() || null,
        date,
      });
      // Reset for next entry; date is kept intentionally
      setAmountStr('0');
      setCategoryId(null);
      setNote('');
      setNoteVisible(false);
    } finally {
      setSaving(false);
    }
  }

  const canSave = parseFloat(amountStr) > 0 && categoryId !== null && !saving;

  // ── Render ───────────────────────────────────────────────────────────────────
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

        {/* Category chips */}
        <FlatList
          horizontal
          style={{ flexGrow: 0 }}
          data={categories}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={styles.catList}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const sel = item.id === categoryId;
            return (
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: sel ? item.color : '#f2f2f7' }]}
                onPress={() => setCategoryId(item.id)}
                activeOpacity={0.7}
              >
                {item.icon ? <Text style={styles.chipIcon}>{item.icon}</Text> : null}
                <Text style={[styles.chipLabel, sel && styles.chipLabelSel]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

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

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnLabel}>SAVE</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Amount
  amountSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  currencyRow:   { flexDirection: 'row', gap: 6, marginBottom: 8 },
  currencyBtn:   {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f2f2f7',
  },
  currencyBtnOn:   { backgroundColor: '#1c1c1e' },
  currencyLabel:   { fontSize: 13, fontWeight: '600', color: '#8e8e93' },
  currencyLabelOn: { color: '#fff' },
  amountText:      {
    fontSize: 64,
    fontWeight: '200',
    color: '#1c1c1e',
    textAlign: 'right',
    letterSpacing: -2,
  },

  // Categories
  catList:      { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip:         {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipIcon:     { fontSize: 16 },
  chipLabel:    { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  chipLabelSel: { color: '#fff' },

  // Note + Date
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

  // Save
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

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Palette ───────────────────────────────────────────────────────────────────

export const PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFA94D', '#FFD43B',
  '#A9E34B', '#69DB7C', '#38D9A9', '#4ECDC4',
  '#45B7D1', '#74C0FC', '#748FFC', '#9775FA',
  '#DA77F2', '#F783AC', '#ADB5BD', '#868E96',
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryValues {
  name: string;
  icon: string | null;
  color: string;
  monthly_budget: number | null;
}

export interface CategoryInit extends CategoryValues {
  id: number;
  parent_id: number | null;
}

interface Props {
  initial?: CategoryInit;
  onSave: (values: CategoryValues) => Promise<void>;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CategoryForm({ initial, onSave, onCancel }: Props) {
  const [name, setName]     = useState(initial?.name ?? '');
  const [icon, setIcon]     = useState(initial?.icon ?? '');
  const [color, setColor]   = useState(initial?.color ?? PALETTE[0]);
  const [budget, setBudget] = useState(
    initial?.monthly_budget != null ? String(initial.monthly_budget) : '',
  );
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const raw = parseFloat(budget);
      await onSave({
        name:           name.trim(),
        icon:           icon.trim() || null,
        color,
        monthly_budget: budget.trim() && !isNaN(raw) ? raw : null,
      });
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{initial ? 'Edit Category' : 'New Category'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave} hitSlop={12}>
            <Text style={[styles.save, !canSave && styles.saveOff]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">

          <View style={styles.section}>
            <Text style={styles.label}>NAME</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                placeholderTextColor="#aaa"
                autoFocus={!initial}
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>ICON (EMOJI, OPTIONAL)</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={icon}
                onChangeText={setIcon}
                placeholder="e.g. 🍽️"
                placeholderTextColor="#aaa"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>COLOR</Text>
            <View style={[styles.card, styles.paletteCard]}>
              {PALETTE.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSel]}
                  onPress={() => setColor(c)}
                  activeOpacity={0.75}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>MONTHLY BUDGET (TND, OPTIONAL)</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                value={budget}
                onChangeText={setBudget}
                placeholder="Leave blank for no budget"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  cancel:      { fontSize: 17, color: '#8e8e93' },
  save:        { fontSize: 17, fontWeight: '600', color: '#007aff' },
  saveOff:     { color: '#c7c7cc' },

  section: { marginTop: 28, paddingHorizontal: 16 },
  label:   { fontSize: 11, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.6, marginBottom: 8 },
  card:    { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16 },
  input:   { height: 48, fontSize: 16, color: '#1c1c1e' },

  paletteCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  swatch:      { width: 36, height: 36, borderRadius: 18 },
  swatchSel:   { borderWidth: 3, borderColor: '#1c1c1e' },
});

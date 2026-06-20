import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>MANAGE</Text>
          <TouchableOpacity style={[styles.row, styles.rowOnly]} onPress={() => router.push('/categories')}>
            <Text style={styles.rowLabel}>Categories &amp; Budgets</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>PREFERENCES</Text>
          <View style={[styles.row, styles.rowFirst]}>
            <Text style={styles.rowLabel}>EUR → TND Rate</Text>
            <Text style={styles.soon}>Coming soon</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Month Start Day</Text>
            <Text style={styles.soon}>Coming soon</Text>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>DATA</Text>
          <View style={[styles.row, styles.rowOnly]}>
            <Text style={styles.rowLabel}>Export CSV</Text>
            <Text style={styles.soon}>Coming soon</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#f2f2f7' },
  scroll:     { padding: 16, paddingBottom: 40 },

  group:      { marginBottom: 24 },
  groupLabel: { fontSize: 11, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  rowLast:  { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  rowOnly:  { borderRadius: 12 },

  rowLabel: { flex: 1, fontSize: 16, color: '#1c1c1e' },
  chevron:  { fontSize: 20, color: '#c7c7cc' },
  soon:     { fontSize: 14, color: '#c7c7cc' },

  divider:  { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginLeft: 16 },
});

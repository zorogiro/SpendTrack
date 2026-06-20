import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('settings.manage')}</Text>
          <TouchableOpacity style={[styles.row, styles.rowOnly]} onPress={() => router.push('/categories')}>
            <Text style={styles.rowLabel}>{t('settings.categories_budgets')}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('settings.preferences')}</Text>
          <View style={[styles.row, styles.rowFirst]}>
            <Text style={styles.rowLabel}>{t('settings.eur_tnd_rate')}</Text>
            <Text style={styles.soon}>{t('settings.coming_soon')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>{t('settings.month_start_day')}</Text>
            <Text style={styles.soon}>{t('settings.coming_soon')}</Text>
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('settings.data')}</Text>
          <View style={[styles.row, styles.rowOnly]}>
            <Text style={styles.rowLabel}>{t('settings.export_csv')}</Text>
            <Text style={styles.soon}>{t('settings.coming_soon')}</Text>
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

  divider:  { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginStart: 16 },
});

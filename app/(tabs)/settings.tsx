import { useCallback, useState } from 'react';
import {
  Alert,
  I18nManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { clearLanguageOverride, getSettings, updateSettings } from '../../db';
import { detectLocale } from '../../lib/i18n';

type LangCode = 'en' | 'fr' | 'ar' | null;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<LangCode>(null);
  const [pickerOpen,  setPickerOpen]  = useState(false);

  useFocusEffect(useCallback(() => {
    getSettings().then(s => setCurrentLang((s.language ?? null) as LangCode));
  }, []));

  function currentLangLabel(): string {
    if (currentLang === 'en') return 'English';
    if (currentLang === 'fr') return 'Français';
    if (currentLang === 'ar') return 'العربية';
    return t('settings.follow_device');
  }

  async function handleLanguageSelect(code: LangCode) {
    // 1. Persist to DB first — source of truth. Written before forceRTL so
    //    that if reloadAsync is a no-op (Expo Go / dev client) or the user
    //    dismisses the Alert without tapping OK, the next manual relaunch still
    //    reads the correct language from DB. forceRTL is stored natively and
    //    also survives without the reload firing.
    if (code === null) {
      await clearLanguageOverride();
    } else {
      await updateSettings({ language: code });
    }

    // 2. Effective language (same resolution as initI18n)
    const effective = code ?? detectLocale();

    // 3. Update UI and close picker before the Alert so the modal is dismissed
    //    regardless of whether the reload fires.
    setCurrentLang(code);
    setPickerOpen(false);

    // 4. RTL requires a full JS bundle reload; a same-direction switch (en↔fr)
    //    is a live string-only update via changeLanguage.
    //    DEV NOTE: Updates.reloadAsync() is often a no-op in Expo Go and dev
    //    clients. If switching to/from Arabic doesn't auto-restart, relaunch
    //    the app manually — this is expected, not a bug in the RTL code.
    const shouldBeRTL = effective === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      Alert.alert(
        t('settings.restart_title'),
        t('settings.restart_body'),
        [{ text: 'OK', onPress: () => Updates.reloadAsync() }],
      );
    } else {
      await i18next.changeLanguage(effective);
    }
  }

  const langOptions: { code: LangCode; label: string }[] = [
    { code: 'en',  label: 'English'  },
    { code: 'fr',  label: 'Français' },
    { code: 'ar',  label: 'العربية'  },
    { code: null,  label: t('settings.follow_device') },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('settings.manage')}</Text>
          <TouchableOpacity style={[styles.row, styles.rowOnly]} onPress={() => router.push('/categories')}>
            <Text style={styles.rowLabel}>{t('settings.categories_budgets')}</Text>
            <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#c7c7cc" />
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('settings.preferences')}</Text>
          <TouchableOpacity style={[styles.row, styles.rowFirst]} onPress={() => setPickerOpen(true)}>
            <Text style={styles.rowLabel}>{t('settings.language_label')}</Text>
            <Text style={styles.rowValue}>{currentLangLabel()}</Text>
            <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#c7c7cc" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.row}>
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

      {/* ── Language picker bottom sheet ─────────────────────────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalWrapper}>
          {/* Backdrop — tapping above the sheet closes without selecting */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPickerOpen(false)}
          />
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('settings.language_label')}</Text>
            {langOptions.map(({ code, label }, i) => {
              const selected = currentLang === code;
              return (
                <View key={String(code)}>
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => handleLanguageSelect(code)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>
                      {label}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color="#007aff" />}
                  </TouchableOpacity>
                  {i < langOptions.length - 1 && <View style={styles.optionDivider} />}
                </View>
              );
            })}
          </SafeAreaView>
        </View>
      </Modal>

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
  rowValue: { fontSize: 16, color: '#8e8e93', marginEnd: 6 },
  soon:     { fontSize: 14, color: '#c7c7cc' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginStart: 16 },

  // Language picker bottom sheet
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d1d6',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8e8e93',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  optionRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  optionLabel:   { flex: 1, fontSize: 17, color: '#1c1c1e' },
  optionLabelOn: { color: '#007aff', fontWeight: '600' },
  optionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginStart: 20 },
});

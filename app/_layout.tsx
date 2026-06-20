import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { runMigrations } from '../db/migrations';
import { seedDefaults } from '../db/seed';
import { getSettings } from '../db';
import { initI18n } from '../lib/i18n';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await runMigrations();
      await seedDefaults();
      const settings = await getSettings();
      await initI18n(settings.language);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18next}>
      <Stack screenOptions={{ headerShown: false }} />
    </I18nextProvider>
  );
}

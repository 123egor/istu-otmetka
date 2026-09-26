import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CredentialsProvider, useCredentials } from '@/features/credentials';
import { clearNativeCookies } from '@/features/session';
import { colors } from '@/ui';

export default function RootLayout() {
  useEffect(() => {
    // При каждом запуске начинаем с чистого листа — никаких сохранённых сессий.
    void clearNativeCookies();
  }, []);

  return (
    <SafeAreaProvider>
      <CredentialsProvider>
        <AppStack />
      </CredentialsProvider>
    </SafeAreaProvider>
  );
}

function AppStack() {
  const { ready } = useCredentials();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Заголовки рисуют сами экраны, поэтому системный header скрыт.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

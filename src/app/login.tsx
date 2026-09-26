import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Profile, useCredentials } from '@/features/credentials';
import { clearNativeCookies } from '@/features/session';
import { StatusBanner, useLoginFlow } from '@/features/web-login';
import { goBack } from '@/lib/navigation';
import { extractAllowedUrl, hostOf } from '@/lib/url';
import { Button, Screen, colors } from '@/ui';

export default function LoginRoute() {
  const params = useLocalSearchParams<{ url?: string; profile?: string }>();
  const { profiles, active } = useCredentials();
  // Экран доступен и по внешней ссылке (otmechalka://login?url=…),
  // поэтому адрес перепроверяется здесь, а не только на главном экране.
  const target = extractAllowedUrl(typeof params.url === 'string' ? params.url : '');

  if (!target.ok) {
    return (
      <Screen>
        <View style={styles.rejected}>
          <Text style={styles.rejectedText}>Ссылка отклонена: {target.reason}</Text>
          <Button title="На главный" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
        </View>
      </Screen>
    );
  }

  // ?profile=<id> — войти под конкретным профилем (кнопка «по этой же ссылке»), иначе под активным.
  const profile = profiles.find((p) => p.id === params.profile) ?? active;

  // key: смена профиля или ссылки — новый сеанс входа с чистым состоянием.
  return <WebLoginScreen key={`${target.url}|${profile?.id ?? ''}`} url={target.url} initialProfile={profile} />;
}

function WebLoginScreen({ url, initialProfile }: { url: string; initialProfile: Profile | null }) {
  // Профиль фиксируется при открытии экрана: смена активного профиля во время входа на него не влияет.
  const [profile] = useState(initialProfile);
  const { profiles } = useCredentials();
  const webRef = useRef<WebView>(null);
  const { phase, currentUrl, loading, webViewProps } = useLoginFlow(webRef, url, profile);

  // Следующий вход по той же ссылке — только вручную, по одному профилю,
  // и только после того, как сессия текущего стёрта (иначе куки аккаунтов смешаются).
  const others = phase.kind === 'wiped' ? profiles.filter((p) => p.id !== profile?.id) : [];

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.host} numberOfLines={1}>
          🔒 {hostOf(currentUrl)}
        </Text>
        {loading && <ActivityIndicator size="small" />}
        <Pressable onPress={() => goBack()} hitSlop={12} style={styles.close}>
          <Text style={styles.closeText}>Готово</Text>
        </Pressable>
      </View>

      {profile && <Text style={styles.profile}>👤 {profile.name}</Text>}
      <StatusBanner phase={phase} />

      {others.length > 0 && (
        <View style={styles.next}>
          {others.map((p) => (
            <Button
              key={p.id}
              title={`Войти под «${p.name}» по этой же ссылке`}
              variant="secondary"
              onPress={async () => {
                await clearNativeCookies(); // стираем всё, что страница успела записать после очистки
                router.replace({ pathname: '/login', params: { url, profile: p.id } });
              }}
            />
          ))}
        </View>
      )}

      <WebView
        ref={webRef}
        source={{ uri: url }}
        // incognito: куки и хранилище живут только в памяти этого WebView,
        // на Android при создании ещё и стираются все старые куки.
        incognito
        cacheEnabled={false}
        sharedCookiesEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        originWhitelist={['https://*']}
        injectedJavaScriptForMainFrameOnly
        {...webViewProps}
        style={{ flex: 1 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  host: { flex: 1, fontSize: 14, color: colors.muted },
  profile: { paddingHorizontal: 14, paddingTop: 8, fontSize: 13, color: colors.muted },
  next: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  close: { paddingHorizontal: 6, paddingVertical: 4 },
  closeText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  rejected: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  rejectedText: { fontSize: 16, color: colors.error, textAlign: 'center' },
});

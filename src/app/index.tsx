import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { TARGET_URL } from '@/config';
import { useCredentials } from '@/features/credentials';
import { extractAllowedUrl } from '@/lib/url';
import { Button, Screen, TextField, colors } from '@/ui';

export default function HomeScreen() {
  const { profiles, active, setActive } = useCredentials();
  const [link, setLink] = useState('');
  const [clipError, setClipError] = useState<string | null>(null);

  const check = useMemo(() => (link.trim() ? extractAllowedUrl(link) : null), [link]);

  async function pasteFromClipboard() {
    setClipError(null);
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        setClipError('Буфер обмена пуст.');
        return;
      }
      const r = extractAllowedUrl(text);
      setLink(r.ok ? r.url : text.trim());
    } catch {
      setClipError('Не удалось прочитать буфер обмена.');
    }
  }

  function open() {
    if (!link.trim()) return router.push({ pathname: '/login', params: { url: TARGET_URL } });
    if (check?.ok) router.push({ pathname: '/login', params: { url: check.url } });
  }

  const inputBorder = !check ? colors.border : check.ok ? colors.success : colors.error;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Отмечалка ИРНИТУ</Text>
          <Text style={styles.subtitle}>
            {active ? `Вход под профилем: ${active.name}` : 'Профилей нет — войдёте вручную'}
          </Text>

          {profiles.length > 1 && (
            <View style={styles.chips}>
              {profiles.map((p) => {
                const selected = p.id === active?.id;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => void setActive(p.id)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Button title="📷  Сканировать QR-код" onPress={() => router.push('/scan')} />

          <Text style={styles.or}>или вставьте ссылку</Text>

          <TextField
            value={link}
            onChangeText={(t) => {
              setLink(t);
              setClipError(null);
            }}
            placeholder="https://marks.istu.edu/view/visit-confirmed/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            borderColor={inputBorder}
          />
          <Text style={[styles.hint, { color: check?.ok ? colors.success : colors.error }]}>
            {clipError ?? (check ? (check.ok ? '✓ Подходящий домен' : `✗ ${check.reason}`) : ' ')}
          </Text>

          <Button title="Вставить из буфера" variant="secondary" onPress={pasteFromClipboard} />

          <Button
            title={link.trim() ? 'Открыть ссылку и войти' : 'Открыть marks.istu.edu'}
            onPress={open}
            disabled={!!check && !check.ok}
            style={{ marginTop: 12 }}
          />

          <Text style={styles.note}>
            Сессия не сохраняется: после входа куки стираются, и при следующем открытии нужно будет войти заново.
          </Text>

          <Button
            title={profiles.length ? `👤  Профили (${profiles.length})` : '👤  Добавить профиль'}
            variant="secondary"
            onPress={() => router.push(profiles.length ? '/profiles' : '/profile')}
            style={{ marginTop: 'auto' }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 10, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 12 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  or: { textAlign: 'center', color: colors.muted, marginVertical: 8 },
  hint: { fontSize: 13, minHeight: 18 },
  note: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 16, marginBottom: 24 },
});

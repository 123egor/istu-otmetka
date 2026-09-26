import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DEFAULT_PROFILE_NAME } from '@/config';
import { useCredentials } from '@/features/credentials';
import { goBack } from '@/lib/navigation';
import { Button, Screen, TextField, colors } from '@/ui';

/** Создание (без ?id) или редактирование (?id=…) профиля. */
export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profiles, save: saveProfile, remove: removeProfile } = useCredentials();
  const current = profiles.find((p) => p.id === id) ?? null;

  const [name, setName] = useState(current?.name ?? '');
  const [login, setLogin] = useState(current?.login ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const pwd = password || current?.password || '';
    if (!login.trim() || !pwd) {
      Alert.alert('Заполните поля', 'Нужны логин и пароль.');
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ id: current?.id, name, login: login.trim(), password: pwd });
      goBack();
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось сохранить: ' + String(e));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!current) return;
    Alert.alert(`Удалить профиль «${current.name}»?`, 'Логин и пароль будут стёрты с телефона.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await removeProfile(current.id);
          goBack();
        },
      },
    ]);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{current ? 'Изменить профиль' : 'Новый профиль'}</Text>
          <Text style={styles.note}>
            Хранится только на этом телефоне в защищённом хранилище (Keychain / Keystore) и подставляется
            исключительно в форму входа на *.istu.edu.
          </Text>

          <Text style={styles.label}>Имя профиля</Text>
          <TextField value={name} onChangeText={setName} placeholder={DEFAULT_PROFILE_NAME} />

          <Text style={styles.label}>Логин (номер студенческого / ЕСИА)</Text>
          <TextField
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
          />

          <Text style={styles.label}>Пароль</Text>
          <TextField
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            placeholder={current ? 'Оставьте пустым, чтобы не менять' : ''}
          />

          <Button title="Сохранить" onPress={save} loading={busy} style={{ marginTop: 16 }} />
          {current && <Button title="Удалить профиль" variant="danger" onPress={remove} />}
          <Button title="Назад" variant="secondary" onPress={() => goBack()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 8, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 12 },
  note: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  label: { fontSize: 13, color: colors.muted, marginTop: 8 },
});

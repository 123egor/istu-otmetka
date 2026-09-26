import * as SecureStore from 'expo-secure-store';
import { DEFAULT_PROFILE_NAME } from '@/config';

// Логин и пароль лежат в системном защищённом хранилище:
// iOS Keychain / Android Keystore. Наружу никуда не уходят,
// кроме формы входа на *.istu.edu внутри WebView.

const KEY_LOGIN = 'istu_login';
const KEY_PASSWORD = 'istu_password';
const KEY_NAME = 'istu_profile_name';

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type Credentials = { name: string; login: string; password: string };

export async function loadCredentials(): Promise<Credentials | null> {
  const [login, password, name] = await Promise.all([
    SecureStore.getItemAsync(KEY_LOGIN, OPTS),
    SecureStore.getItemAsync(KEY_PASSWORD, OPTS),
    SecureStore.getItemAsync(KEY_NAME, OPTS),
  ]);
  if (!login || !password) return null;
  return { name: name || DEFAULT_PROFILE_NAME, login, password };
}

export async function saveCredentials(c: Credentials): Promise<void> {
  await SecureStore.setItemAsync(KEY_LOGIN, c.login, OPTS);
  await SecureStore.setItemAsync(KEY_PASSWORD, c.password, OPTS);
  await SecureStore.setItemAsync(KEY_NAME, c.name || DEFAULT_PROFILE_NAME, OPTS);
}

export async function deleteCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_LOGIN, OPTS),
    SecureStore.deleteItemAsync(KEY_PASSWORD, OPTS),
    SecureStore.deleteItemAsync(KEY_NAME, OPTS),
  ]);
}

import * as SecureStore from 'expo-secure-store';
import { DEFAULT_PROFILE_NAME } from '@/config';

// Профили (имя, логин, пароль) лежат в системном защищённом хранилище:
// iOS Keychain / Android Keystore. Наружу никуда не уходят,
// кроме формы входа на *.istu.edu внутри WebView.
//
// Раскладка ключей:
//   istu_profiles        — JSON-список [{ id, name }] (без секретов)
//   istu_profile_<id>    — JSON { login, password } одного профиля
//   istu_active_profile  — id профиля, под которым входить

const KEY_INDEX = 'istu_profiles';
const KEY_ACTIVE = 'istu_active_profile';
const secretKey = (id: string) => `istu_profile_${id}`;

// Ключи первой версии (один профиль) — переносятся в новый формат при первом запуске.
const LEGACY_LOGIN = 'istu_login';
const LEGACY_PASSWORD = 'istu_password';
const LEGACY_NAME = 'istu_profile_name';

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type Profile = { id: string; name: string; login: string; password: string };
/** Данные нового или изменяемого профиля: без id — создать, с id — обновить. */
export type ProfileInput = Omit<Profile, 'id'> & { id?: string };

type IndexEntry = { id: string; name: string };
type Secret = { login: string; password: string };

export type ProfilesState = { profiles: Profile[]; activeId: string | null };

function newId(): string {
  // Только [a-z0-9] — допустимые символы для ключей SecureStore.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readIndex(): Promise<IndexEntry[]> {
  const list = parseJson<IndexEntry[]>(await SecureStore.getItemAsync(KEY_INDEX, OPTS));
  return Array.isArray(list) ? list.filter((e) => e && typeof e.id === 'string') : [];
}

async function writeIndex(list: IndexEntry[]): Promise<void> {
  await SecureStore.setItemAsync(KEY_INDEX, JSON.stringify(list), OPTS);
}

async function migrateLegacy(): Promise<void> {
  const [login, password, name] = await Promise.all([
    SecureStore.getItemAsync(LEGACY_LOGIN, OPTS),
    SecureStore.getItemAsync(LEGACY_PASSWORD, OPTS),
    SecureStore.getItemAsync(LEGACY_NAME, OPTS),
  ]);
  if (!login || !password) return;

  const id = newId();
  await SecureStore.setItemAsync(secretKey(id), JSON.stringify({ login, password } satisfies Secret), OPTS);
  await writeIndex([...(await readIndex()), { id, name: name || DEFAULT_PROFILE_NAME }]);
  await SecureStore.setItemAsync(KEY_ACTIVE, id, OPTS);
  await Promise.all([LEGACY_LOGIN, LEGACY_PASSWORD, LEGACY_NAME].map((k) => SecureStore.deleteItemAsync(k, OPTS)));
}

export async function loadProfiles(): Promise<ProfilesState> {
  await migrateLegacy();

  const index = await readIndex();
  const profiles: Profile[] = [];
  for (const { id, name } of index) {
    const secret = parseJson<Secret>(await SecureStore.getItemAsync(secretKey(id), OPTS));
    if (secret?.login && secret.password) profiles.push({ id, name, ...secret });
  }

  const storedActive = await SecureStore.getItemAsync(KEY_ACTIVE, OPTS);
  const activeId = profiles.some((p) => p.id === storedActive) ? storedActive : (profiles[0]?.id ?? null);
  return { profiles, activeId };
}

export async function saveProfile(input: ProfileInput): Promise<Profile> {
  const profile: Profile = {
    id: input.id ?? newId(),
    name: input.name.trim() || DEFAULT_PROFILE_NAME,
    login: input.login,
    password: input.password,
  };
  await SecureStore.setItemAsync(
    secretKey(profile.id),
    JSON.stringify({ login: profile.login, password: profile.password } satisfies Secret),
    OPTS,
  );

  const index = await readIndex();
  const entry = { id: profile.id, name: profile.name };
  const pos = index.findIndex((e) => e.id === profile.id);
  if (pos >= 0) index[pos] = entry;
  else index.push(entry);
  await writeIndex(index);
  return profile;
}

export async function deleteProfile(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(secretKey(id), OPTS);
  await writeIndex((await readIndex()).filter((e) => e.id !== id));
}

export async function saveActiveProfileId(id: string | null): Promise<void> {
  if (id) await SecureStore.setItemAsync(KEY_ACTIVE, id, OPTS);
  else await SecureStore.deleteItemAsync(KEY_ACTIVE, OPTS);
}

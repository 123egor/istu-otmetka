import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Profile,
  ProfileInput,
  deleteProfile,
  loadProfiles,
  saveActiveProfileId,
  saveProfile,
} from './storage';

type CredentialsContextValue = {
  /** Все сохранённые профили. */
  profiles: Profile[];
  /** Профиль, под которым выполняется вход, или null, если профилей нет. */
  active: Profile | null;
  /** false, пока данные читаются из защищённого хранилища. */
  ready: boolean;
  /** Создаёт (без id) или обновляет профиль. Новый профиль становится активным. */
  save: (input: ProfileInput) => Promise<Profile>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
};

const CredentialsContext = createContext<CredentialsContextValue | null>(null);

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadProfiles()
      .then((s) => {
        setProfiles(s.profiles);
        setActiveId(s.activeId);
      })
      .catch(() => setProfiles([]))
      .finally(() => setReady(true));
  }, []);

  const setActive = useCallback(async (id: string) => {
    await saveActiveProfileId(id);
    setActiveId(id);
  }, []);

  const save = useCallback(
    async (input: ProfileInput) => {
      const saved = await saveProfile(input);
      setProfiles((list) =>
        list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved],
      );
      if (!input.id) await setActive(saved.id);
      return saved;
    },
    [setActive],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteProfile(id);
      const rest = profiles.filter((p) => p.id !== id);
      setProfiles(rest);
      if (activeId === id) {
        const next = rest[0]?.id ?? null;
        await saveActiveProfileId(next);
        setActiveId(next);
      }
    },
    [profiles, activeId],
  );

  const active = profiles.find((p) => p.id === activeId) ?? null;

  const value = useMemo(
    () => ({ profiles, active, ready, save, remove, setActive }),
    [profiles, active, ready, save, remove, setActive],
  );

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}

export function useCredentials(): CredentialsContextValue {
  const ctx = useContext(CredentialsContext);
  if (!ctx) throw new Error('useCredentials должен вызываться внутри <CredentialsProvider>');
  return ctx;
}

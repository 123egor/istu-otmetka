import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Credentials, deleteCredentials, loadCredentials, saveCredentials } from './storage';

type CredentialsContextValue = {
  /** Сохранённые данные или null, если их нет. */
  credentials: Credentials | null;
  /** false, пока данные читаются из защищённого хранилища. */
  ready: boolean;
  save: (c: Credentials) => Promise<void>;
  remove: () => Promise<void>;
};

const CredentialsContext = createContext<CredentialsContextValue | null>(null);

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadCredentials()
      .then(setCredentials)
      .catch(() => setCredentials(null))
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(async (c: Credentials) => {
    await saveCredentials(c);
    setCredentials(c);
  }, []);

  const remove = useCallback(async () => {
    await deleteCredentials();
    setCredentials(null);
  }, []);

  const value = useMemo(() => ({ credentials, ready, save, remove }), [credentials, ready, save, remove]);

  return <CredentialsContext.Provider value={value}>{children}</CredentialsContext.Provider>;
}

export function useCredentials(): CredentialsContextValue {
  const ctx = useContext(CredentialsContext);
  if (!ctx) throw new Error('useCredentials должен вызываться внутри <CredentialsProvider>');
  return ctx;
}

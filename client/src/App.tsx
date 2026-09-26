import { useState, useEffect } from 'react';
import { GateScreen } from './screens/GateScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { BatchScreen } from './screens/BatchScreen';
import { checkAuth, logout as apiLogout, setOnUnauthorized } from './api';
import { colors } from './theme';

type Nav = 'batch' | 'accounts';

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [nav, setNav] = useState<Nav>('batch');

  // Проверяем сессию при загрузке; при 401 из любого запроса — возвращаем на гейт.
  useEffect(() => {
    setOnUnauthorized(() => setAuthed(false));
    checkAuth().then(setAuthed);
  }, []);

  async function handleLogout() {
    try { await apiLogout(); } catch { /* игнор */ }
    setAuthed(false);
    setNav('batch');
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', maxWidth: 480, margin: '0 auto', backgroundColor: '#fff' }}>
      {children}
    </div>
  );

  if (authed === null) {
    return shell(
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 28, height: 28, border: `3px solid ${colors.border}`, borderTopColor: colors.primary, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      </div>,
    );
  }

  if (!authed) {
    return shell(<GateScreen onAuthed={() => setAuthed(true)} />);
  }

  return shell(
    <>
      {nav === 'batch' && (
        <BatchScreen onManageAccounts={() => setNav('accounts')} onLogout={handleLogout} />
      )}
      {nav === 'accounts' && (
        <AccountsScreen onBack={() => setNav('batch')} />
      )}
    </>,
  );
}

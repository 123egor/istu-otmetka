import { useState } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors } from '../theme';
import { login } from '../api';

export function GateScreen({ onAuthed }: { onAuthed: () => void }) {
  const [username, setUsername] = useState('student');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!password) { setError('Введите пароль'); return; }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      onAuthed();
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 40 }}>🔐</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: '8px 0 4px' }}>Отмечалка ИРНИТУ</h1>
        <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>Вход в приложение</p>
      </div>

      <TextField
        label="Логин"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
      />

      <TextField
        label="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        autoComplete="current-password"
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
      />

      {error && <span style={{ fontSize: 13, color: colors.error }}>{error}</span>}

      <Button title="Войти" onPress={submit} loading={busy} disabled={!password} style={{ marginTop: 8 }} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors } from '../theme';
import { getAccounts, upsertAccount, deleteAccount } from '../api';
import type { Account } from '../types';

type Props = {
  onBack: () => void;
};

export function AccountsScreen({ onBack }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', login: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setAccounts(await getAccounts());
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!form.login.trim() || !form.password.trim()) {
      setError('Нужны логин и пароль'); return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertAccount(form.name || 'Аккаунт', form.login.trim(), form.password.trim());
      await load();
      setAdding(false);
      setForm({ name: '', login: '', password: '' });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Удалить аккаунт?')) return;
    await deleteAccount(id);
    await load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px', color: colors.primary }}>‹</button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>Аккаунты</h1>
      </div>

      <p style={{ fontSize: 13, color: colors.muted, margin: 0 }}>
        Логины и пароли хранятся в базе данных на сервере и используются только для входа на *.istu.edu.
      </p>

      {accounts.length === 0 && !adding && (
        <p style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>Нет сохранённых аккаунтов</p>
      )}

      {accounts.map((a) => (
        <div
          key={a.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 14px',
            borderRadius: 12,
            border: `1.5px solid ${colors.border}`,
            backgroundColor: colors.bg,
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: colors.text }}>{a.name}</div>
            <div style={{ fontSize: 13, color: colors.muted }}>{a.login}</div>
          </div>
          <button
            onClick={() => void remove(a.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error, fontSize: 18, padding: '4px 8px' }}
          >
            ×
          </button>
        </div>
      ))}

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12, border: `1.5px solid ${colors.border}` }}>
          <h3 style={{ margin: 0, fontSize: 16, color: colors.text }}>Новый аккаунт</h3>
          <TextField
            label="Имя профиля"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Студент"
          />
          <TextField
            label="Логин (номер студенческого / ЕСИА)"
            value={form.login}
            onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <TextField
            label="Пароль"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            type="password"
          />
          {error && <span style={{ fontSize: 13, color: colors.error }}>{error}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button title="Сохранить" onPress={save} loading={busy} style={{ flex: 1 }} />
            <Button title="Отмена" variant="secondary" onPress={() => { setAdding(false); setError(null); }} style={{ flex: 1 }} />
          </div>
        </div>
      )}

      {!adding && (
        <Button title="+ Добавить аккаунт" variant="secondary" onPress={() => setAdding(true)} />
      )}

      <Button title="Назад" variant="secondary" onPress={onBack} style={{ marginTop: 'auto' }} />
    </div>
  );
}

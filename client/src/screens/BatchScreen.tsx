import { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { QrScanner } from '../components/QrScanner';
import { colors } from '../theme';
import { getAccounts, startBatch, streamBatch } from '../api';
import type { Account, BatchResultRow } from '../types';

const TARGET_URL = 'https://marks.istu.edu/';

type Props = { onManageAccounts: () => void; onLogout: () => void };

type JobResult = BatchResultRow & { pending?: boolean };

const STATUS_ICON: Record<string, string> = {
  success: '✅',
  wrong_credentials: '🔑',
  error: '❌',
  timeout: '⏱',
  pending: '⏳',
};

export function BatchScreen({ onManageAccounts, onLogout }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [url, setUrl] = useState(TARGET_URL);
  const [concurrency, setConcurrency] = useState(5);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<JobResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; ok: number; fail: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    getAccounts().then(setAccounts);
  }, []);

  function toggleAll() {
    if (selected.size === accounts.length) setSelected(new Set());
    else setSelected(new Set(accounts.map((a) => a.id)));
  }

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function run() {
    if (selected.size === 0) { setError('Выберите хотя бы один аккаунт'); return; }
    if (!url.trim()) { setError('Введите URL'); return; }

    setError(null);
    setRunning(true);
    setSummary(null);

    const sel = [...selected];

    // Начальное состояние — всё pending
    const initial: JobResult[] = accounts
      .filter((a) => sel.includes(a.id))
      .map((a) => ({ id: 0, job_id: '', login: a.login, status: 'success', result_url: null, page_title: null, message: null, pending: true }));
    setResults(initial);

    try {
      const { jobId, total } = await startBatch(sel, url, concurrency);
      let ok = 0;
      let fail = 0;

      const stop = streamBatch(
        jobId,
        (row) => {
          setResults((prev) => prev.map((r) => r.login === row.login ? { ...row, pending: false } : r));
          if (row.status === 'success') ok++;
          else fail++;
        },
        (total) => {
          setSummary({ total, ok, fail });
          setRunning(false);
          stop();
        },
      );

      // Fallback: если SSE не пришёл
      setTimeout(() => { if (running) { setSummary({ total, ok, fail: total - ok }); setRunning(false); stop(); } }, 5 * 60_000);
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  }

  if (scanning) {
    return (
      <QrScanner
        onResult={(scanned) => { setUrl(scanned); setScanning(false); }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, flex: 1 }}>Отмечалка ИРНИТУ</h1>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: colors.danger, padding: '4px 8px', fontWeight: 600 }}>Выйти</button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TextField
          label="URL для авторизации"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
        />
        <Button title="📷  Сканировать QR-код" variant="secondary" onPress={() => setScanning(true)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, color: colors.muted, whiteSpace: 'nowrap' }}>Параллельность: {concurrency}</label>
          <input
            type="range"
            min={1}
            max={20}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        {/* Список аккаунтов */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: colors.muted }}>Аккаунты ({selected.size}/{accounts.length})</span>
            <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: colors.primary, fontSize: 13, cursor: 'pointer', padding: '2px 6px' }}>
              {selected.size === accounts.length ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>

          {accounts.length === 0 && (
            <p style={{ color: colors.muted, fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
              Нет аккаунтов. Добавьте их в разделе «Аккаунты».
            </p>
          )}

          <button
            onClick={onManageAccounts}
            style={{ background: 'none', border: `1px dashed ${colors.border}`, color: colors.primary, fontSize: 13, cursor: 'pointer', padding: '8px', borderRadius: 8, width: '100%', marginBottom: 6 }}
          >
            + Управление аккаунтами
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accounts.map((a) => (
              <label key={a.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: `1.5px solid ${selected.has(a.id) ? colors.primary : colors.border}`,
                backgroundColor: selected.has(a.id) ? colors.primaryBg : colors.bg,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>{a.login}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && <span style={{ fontSize: 13, color: colors.error }}>{error}</span>}

        <Button
          title={running ? `Выполняется… (${results.filter((r) => !r.pending).length}/${results.length})` : 'Запустить'}
          onPress={run}
          loading={running}
          disabled={running || accounts.length === 0}
        />

        {/* Результаты */}
        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: colors.muted, fontWeight: 600 }}>Результаты</span>
            {results.map((r, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                backgroundColor: r.pending ? '#f9fafb'
                  : r.status === 'success' ? colors.okBg
                  : r.status === 'wrong_credentials' ? colors.warnBg
                  : colors.errBg,
              }}>
                <span style={{ fontSize: 18 }}>{STATUS_ICON[r.pending ? 'pending' : r.status] ?? '?'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{r.login}</div>
                  {!r.pending && (
                    <div style={{ fontSize: 12, color: colors.muted }}>
                      {r.status === 'success' ? r.page_title ?? 'Успешно'
                        : r.status === 'wrong_credentials' ? 'Неверный логин или пароль'
                        : r.message ?? r.status}
                    </div>
                  )}
                  {r.pending && <div style={{ fontSize: 12, color: colors.muted }}>Ожидание…</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {summary && (
          <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: summary.fail === 0 ? colors.okBg : colors.warnBg }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>
              Готово: {summary.ok}/{summary.total} успешно
            </div>
            {summary.fail > 0 && (
              <div style={{ fontSize: 13, color: colors.muted }}>Не удалось: {summary.fail}</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

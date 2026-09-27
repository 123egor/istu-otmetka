import { useState, useCallback } from 'react';
import { Button } from './Button';

const ALLOWED_HOSTS = ['marks.istu.edu', 'app.istu.edu'];

export function parseQrUrl(raw: string): string | null {
  const match = raw.match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = match ? match[0].replace(/[),.;]+$/, '') : raw.trim();
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'https:') return null;
    if (!ALLOWED_HOSTS.includes(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function QrScanner({ onResult, onCancel }: { onResult: (url: string) => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const videoRef = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;

    let stopped = false;

    // На не-HTTPS (кроме localhost) браузер не даёт доступ к камере —
    // navigator.mediaDevices может быть undefined. Показываем понятное сообщение.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Камера доступна только по HTTPS. Откройте сайт по https:// или вставьте ссылку вручную.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        video.srcObject = stream;
        void video.play();
        void scanLoop(video);
      })
      .catch(() => setError('Нет доступа к камере. Разрешите доступ в настройках браузера.'));

    async function scanLoop(v: HTMLVideoElement) {
      if (!('BarcodeDetector' in window)) {
        setError('Браузер не поддерживает сканер QR. Попробуйте Chrome или вставьте ссылку вручную.');
        return;
      }
      // @ts-expect-error BarcodeDetector — экспериментальный API
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      while (!stopped) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const barcodes = await detector.detect(v);
          if (barcodes.length > 0) {
            const url = parseQrUrl(barcodes[0].rawValue as string);
            if (url) {
              stopped = true;
              (v.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
              onResult(url);
              return;
            }
          }
        } catch {
          /* продолжаем сканировать */
        }
      }
    }
  }, [onResult]);

  return (
    <div style={{ flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
      <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Наведите камеру на QR-код</span>
        <div style={{ width: 240, height: 240, border: '3px solid #fff', borderRadius: 20 }} />
        {error && (
          <span style={{ color: '#fff', backgroundColor: 'rgba(220,38,38,0.9)', padding: '10px 16px', borderRadius: 8, textAlign: 'center' }}>
            {error}
          </span>
        )}
        <Button title="Отмена" variant="secondary" onPress={onCancel} style={{ backgroundColor: 'rgba(255,255,255,0.95)' }} />
      </div>
    </div>
  );
}

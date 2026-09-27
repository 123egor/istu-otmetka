import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1); // > min => показываем ползунок
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const nativeZoomRef = useRef(false);
  const zoomRef = useRef(1);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const video = videoRef.current;
    if (!video || !ctx) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Камера доступна только по HTTPS. Откройте сайт по https:// или вставьте ссылку вручную.');
      return;
    }

    function stopStream() {
      if (timer) clearTimeout(timer);
      const s = video!.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
    }

    function scanTick() {
      if (stopped) return;
      const v = video!;
      if (v.readyState >= v.HAVE_CURRENT_DATA && v.videoWidth) {
        // Цифровой зум: вырезаем центральную область кадра
        const zf = nativeZoomRef.current ? 1 : zoomRef.current;
        const sw = Math.max(1, Math.floor(v.videoWidth / zf));
        const sh = Math.max(1, Math.floor(v.videoHeight / zf));
        const sx = Math.floor((v.videoWidth - sw) / 2);
        const sy = Math.floor((v.videoHeight - sh) / 2);
        canvas.width = sw;
        canvas.height = sh;
        ctx!.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
        const img = ctx!.getImageData(0, 0, sw, sh);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const url = parseQrUrl(code.data);
          if (url) {
            stopped = true;
            stopStream();
            onResult(url);
            return;
          }
        }
      }
      timer = setTimeout(scanTick, 150);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        video.srcObject = stream;
        return video.play().then(() => stream);
      })
      .then((stream) => {
        const track = stream.getVideoTracks()[0];
        trackRef.current = track ?? null;
        const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } };
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          nativeZoomRef.current = true;
          setZoomMin(caps.zoom.min);
          setZoomMax(caps.zoom.max);
          zoomRef.current = caps.zoom.min;
          setZoom(caps.zoom.min);
        } else {
          setZoomMin(1);
          setZoomMax(4); // цифровой зум до 4x
        }
        scanTick();
      })
      .catch(() => setError('Нет доступа к камере. Разрешите доступ в браузере.'));

    return () => {
      stopped = true;
      stopStream();
    };
  }, [onResult]);

  function changeZoom(z: number) {
    zoomRef.current = z;
    setZoom(z);
    if (nativeZoomRef.current && trackRef.current) {
      trackRef.current.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).catch(() => {});
    }
  }

  const digitalScale = nativeZoomRef.current ? 1 : zoom;

  return (
    <div style={{ flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${digitalScale})`, transformOrigin: 'center' }}
        playsInline
        muted
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>Наведите камеру на QR-код</span>
        <div style={{ width: 240, height: 240, border: '3px solid #fff', borderRadius: 20, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.35)' }} />
        {error && (
          <span style={{ color: '#fff', backgroundColor: 'rgba(220,38,38,0.92)', padding: '10px 16px', borderRadius: 8, textAlign: 'center' }}>
            {error}
          </span>
        )}

        {zoomMax > zoomMin && !error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 320, background: 'rgba(0,0,0,0.45)', padding: '8px 14px', borderRadius: 12 }}>
            <span style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap' }}>🔍 {zoom.toFixed(1)}x</span>
            <input
              type="range"
              min={zoomMin}
              max={zoomMax}
              step={0.1}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        )}

        <Button title="Отмена" variant="secondary" onPress={onCancel} style={{ backgroundColor: 'rgba(255,255,255,0.95)', maxWidth: 320 }} />
      </div>
    </div>
  );
}

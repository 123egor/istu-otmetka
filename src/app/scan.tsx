import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { goBack } from '@/lib/navigation';
import { extractAllowedUrl } from '@/lib/url';
import { Button, Screen, colors } from '@/ui';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);
  const lastRejected = useRef<string | null>(null);

  if (!permission) {
    return <Screen>{null}</Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.text}>Нужен доступ к камере, чтобы сканировать QR-код.</Text>
          {permission.canAskAgain ? (
            <Button title="Разрешить камеру" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
          ) : (
            <Text style={styles.text}>Разрешите доступ к камере в настройках телефона.</Text>
          )}
          <Button
            title="Назад"
            variant="secondary"
            onPress={() => goBack()}
            style={{ alignSelf: 'stretch', marginTop: 12 }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen dark>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current || data === lastRejected.current) return;
          const r = extractAllowedUrl(data);
          if (r.ok) {
            handled.current = true;
            // replace: «Назад» со страницы входа ведёт на главный, а не обратно в камеру.
            router.replace({ pathname: '/login', params: { url: r.url } });
          } else {
            lastRejected.current = data;
            setError(r.reason);
          }
        }}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.hint}>Наведите камеру на QR-код посещения</Text>
        <View style={styles.frame} />
        {error ? <Text style={styles.error}>{error}</Text> : <View style={{ height: 40 }} />}
        <Button title="Отмена" variant="secondary" onPress={() => goBack()} style={styles.cancel} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.bg },
  text: { fontSize: 16, color: colors.text, textAlign: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  hint: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  frame: { width: 250, height: 250, borderWidth: 3, borderColor: '#fff', borderRadius: 20 },
  error: {
    color: '#fff',
    backgroundColor: 'rgba(220,38,38,0.9)',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    overflow: 'hidden',
  },
  cancel: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#fff' },
});

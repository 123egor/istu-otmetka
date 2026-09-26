import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/ui';
import type { LoginPhase } from './useLoginFlow';

function describe(phase: LoginPhase): { text: string; bg: string } {
  switch (phase.kind) {
    case 'loading':
      return { text: 'Загрузка…', bg: colors.infoBg };
    case 'submitting':
      return { text: 'Выполняется вход…', bg: colors.infoBg };
    case 'manual':
      return { text: phase.message, bg: colors.warnBg };
    case 'authorized':
      return { text: '✓ Вход выполнен. Через пару секунд сессия будет стёрта.', bg: colors.okBg };
    case 'wiped':
      return { text: '✓ Вход выполнен, куки очищены. В следующий раз потребуется войти заново.', bg: colors.okBg };
    case 'error':
      return { text: phase.message, bg: colors.errBg };
  }
}

export function StatusBanner({ phase }: { phase: LoginPhase }) {
  const { text, bg } = describe(phase);
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 14, paddingVertical: 8 },
  text: { fontSize: 13, color: colors.text },
});

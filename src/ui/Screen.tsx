import { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';

type Props = {
  children: ReactNode;
  /** Тёмный экран (камера): чёрный фон и светлый статус-бар. */
  dark?: boolean;
};

/** Корневой контейнер экрана: безопасные отступы, фон и стиль статус-бара. */
export function Screen({ children, dark = false }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? '#000' : colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

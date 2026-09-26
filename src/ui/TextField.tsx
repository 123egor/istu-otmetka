import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors } from './theme';

type Props = TextInputProps & { borderColor?: string };

/** Поле ввода в общем стиле приложения. */
export function TextField({ borderColor = colors.border, style, ...rest }: Props) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...rest}
      style={[styles.input, { borderColor }, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
});

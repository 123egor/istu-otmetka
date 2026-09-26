import { type CSSProperties, type InputHTMLAttributes } from 'react';
import { colors } from '../theme';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  borderColor?: string;
  style?: CSSProperties;
};

export function TextField({ label, borderColor, style, ...rest }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <span style={{ fontSize: 13, color: colors.muted }}>{label}</span>
      )}
      <input
        {...rest}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 10,
          border: `1.5px solid ${borderColor ?? colors.border}`,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.bg,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = borderColor ?? colors.primary;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = borderColor ?? colors.border;
        }}
      />
    </div>
  );
}

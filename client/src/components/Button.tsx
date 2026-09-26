import { type CSSProperties, type ReactNode } from 'react';
import { colors } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: CSSProperties;
};

const variantStyles: Record<Variant, CSSProperties> = {
  primary: {
    backgroundColor: colors.primary,
    color: '#fff',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'transparent',
    color: colors.primary,
    border: `1.5px solid ${colors.border}`,
  },
  danger: {
    backgroundColor: 'transparent',
    color: colors.danger,
    border: `1.5px solid ${colors.danger}`,
  },
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style }: Props) {
  const base: CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: disabled || loading ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: disabled ? 0.5 : 1,
    transition: 'opacity 0.15s',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    boxSizing: 'border-box',
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      style={base}
      onClick={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
    >
      {loading ? <Spinner color={variant === 'primary' ? '#fff' : colors.primary} /> : icon}
      {title}
    </button>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        border: `2px solid ${color}44`,
        borderTopColor: color,
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}

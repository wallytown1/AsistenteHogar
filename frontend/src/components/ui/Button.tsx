import React from 'react';
import { Pressable, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Icon, IconName } from './Icon';
import { AppText } from './AppText';
import { haptics } from '../../lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<Variant, { bg: string; fg: string; border?: string; ripple: string }> = {
  primary: { bg: colors.brand, fg: colors.onBrand, ripple: 'rgba(255,255,255,0.25)' },
  secondary: { bg: colors.brandSoft, fg: colors.brandDark, ripple: 'rgba(99,102,241,0.18)' },
  ghost: { bg: 'transparent', fg: colors.ink, border: colors.borderStrong, ripple: 'rgba(17,24,39,0.06)' },
  danger: { bg: colors.danger, fg: colors.white, ripple: 'rgba(255,255,255,0.25)' },
};

const sizing: Record<Size, { pv: number; fontSize: number; iconSize: number }> = {
  sm: { pv: 9, fontSize: 13, iconSize: 16 },
  md: { pv: 13, fontSize: 15, iconSize: 18 },
  lg: { pv: 16, fontSize: 16, iconSize: 20 },
};

/** Botón con haptics, ripple Material en Android y estados loading/disabled. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  fullWidth = true,
  style,
}: ButtonProps) {
  const p = palette[variant];
  const s = sizing[size];
  const isDisabled = disabled || loading;
  const fg = isDisabled ? colors.inkFaint : p.fg;

  const base: ViewStyle = {
    backgroundColor: isDisabled ? colors.track : p.bg,
    borderRadius: radius.pill,
    paddingVertical: s.pv,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: p.border ? 1 : 0,
    borderColor: p.border,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
  };

  return (
    <Pressable
      onPress={isDisabled ? undefined : () => { haptics.light(); onPress?.(); }}
      android_ripple={{ color: p.ripple }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [base, pressed && !isDisabled ? { opacity: 0.9 } : null, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={s.iconSize} color={fg} /> : null}
          <AppText variant="bodyStrong" color={fg} style={{ fontSize: s.fontSize }}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

import React from 'react';
import { Pressable } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { haptics } from '../../lib/haptics';

export type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  activeColor?: string;
  flex?: boolean;
};

/** Pastilla de filtro/selección con estado activo. */
export function Chip({
  label,
  active,
  onPress,
  icon,
  activeColor = colors.brand,
  flex,
}: ChipProps) {
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptics.selection();
              onPress();
            }
          : undefined
      }
      android_ripple={{ color: 'rgba(139,94,60,0.15)' }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 9,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          borderWidth: 1,
          flex: flex ? 1 : undefined,
          backgroundColor: active ? activeColor : colors.card,
          borderColor: active ? activeColor : colors.borderStrong,
        },
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      {icon ? <Icon name={icon} size={15} color={active ? colors.white : colors.inkMuted} /> : null}
      <AppText variant="captionStrong" color={active ? colors.white : colors.inkMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

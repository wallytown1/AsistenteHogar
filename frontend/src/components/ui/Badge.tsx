import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type BadgeProps = {
  label: string;
  color?: string;
  bg?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** Etiqueta de estado compacta con tinte. */
export function Badge({ label, color = colors.brandDark, bg = colors.brandSoft, icon, style }: BadgeProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: bg },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <AppText variant="micro" color={color} style={{ fontWeight: '700' }}>{label}</AppText>
    </View>
  );
}

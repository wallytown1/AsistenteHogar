import React from 'react';
import { View, TextInput, TextInputProps, StyleProp, TextStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { AppText } from './AppText';

export type FieldProps = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

/** Campo de texto con etiqueta superior, coherente con el sistema. */
export function Field({ label, containerStyle, inputStyle, ...rest }: FieldProps) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <AppText variant="label" color={colors.inkMuted} style={{ marginBottom: 6 }}>{label}</AppText> : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={[
          {
            backgroundColor: colors.cardAlt,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: 12,
            fontSize: 15,
            color: colors.ink,
          },
          inputStyle,
        ]}
        {...rest}
      />
    </View>
  );
}

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { colors, radius, spacing } from '../../theme/tokens';
import { AppText } from './AppText';

type ToastTipo = 'info' | 'success' | 'error';

export interface ToastConfig {
  mensaje: string;
  tipo?: ToastTipo;
  accion?: { label: string; onPress: () => void };
}

interface ToastState extends ToastConfig {
  id: number;
}

interface ToastContextValue {
  show: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TIPO_STYLE: Record<ToastTipo, { bg: string; text: string; border: string }> = {
  info: { bg: colors.card, text: colors.ink, border: colors.border },
  success: { bg: colors.successSoft, text: colors.success, border: colors.success },
  error: { bg: colors.dangerSoft, text: colors.danger, border: colors.danger },
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const show = useCallback((config: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ ...config, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <View style={{ flex: 1 }}>
        {children}
        <AnimatePresence>
          {toast && (
            <MotiView
              key={toast.id}
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: 16 }}
              transition={{ type: 'timing', duration: 220 }}
              style={[
                styles.container,
                {
                  backgroundColor: TIPO_STYLE[toast.tipo ?? 'info'].bg,
                  borderColor: TIPO_STYLE[toast.tipo ?? 'info'].border,
                },
              ]}
            >
              <AppText
                variant="captionStrong"
                color={TIPO_STYLE[toast.tipo ?? 'info'].text}
                style={{ flex: 1 }}
              >
                {toast.mensaje}
              </AppText>
              {toast.accion && (
                <Pressable
                  onPress={() => {
                    toast.accion!.onPress();
                    dismiss();
                  }}
                  hitSlop={8}
                >
                  <AppText
                    variant="captionStrong"
                    color={colors.brand}
                    style={{ marginLeft: spacing.md }}
                  >
                    {toast.accion.label}
                  </AppText>
                </Pressable>
              )}
              <Pressable onPress={dismiss} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                <AppText variant="caption" color={TIPO_STYLE[toast.tipo ?? 'info'].text}>
                  ✕
                </AppText>
              </Pressable>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    elevation: 8,
  },
});

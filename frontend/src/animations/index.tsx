// frontend/src/animations/index.ts
// Sistema de movimiento "Tierra Cálida" — Reanimated 4 + Moti
// Todas las primitivas marcadas [UI] corren en el UI thread via worklets.
// useCountUp [JS] corre en JS thread (convierte number→string cada frame).

import React, { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { MotiView, AnimatePresence } from 'moti';

// ─── DNA del movimiento ───────────────────────────────────────────────────────

export const MOTION = {
  spring: { damping: 18, stiffness: 200, mass: 1 } as const,
  springGentle: { damping: 22, stiffness: 160, mass: 1 } as const,
  springSnappy: { damping: 14, stiffness: 320, mass: 0.8 } as const,
  fadeDuration: 280,
  counterDuration: 1200,
  staggerInterval: 55,
} as const;

// ─── 1. FadeInView [UI] ───────────────────────────────────────────────────────

export function FadeInView({
  children,
  delay = 0,
  duration = MOTION.fadeDuration,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration, delay, easing: Easing.out(Easing.cubic) }}
      style={style}
    >
      {children}
    </MotiView>
  );
}

// ─── 2. SlideInCard [UI] ──────────────────────────────────────────────────────

export function SlideInCard({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <MotiView
      from={{ opacity: 0, translateY: reduceMotion ? 0 : 20, scale: reduceMotion ? 1 : 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={
        reduceMotion
          ? { type: 'timing', duration: 0 }
          : {
              type: 'spring',
              delay,
              damping: MOTION.springGentle.damping,
              stiffness: MOTION.springGentle.stiffness,
              opacity: { type: 'timing', duration: MOTION.fadeDuration, delay },
            }
      }
      style={style}
    >
      {children}
    </MotiView>
  );
}

// ─── 3. ScalePress [UI] ───────────────────────────────────────────────────────

interface ScalePressProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
}

export function ScalePress({
  children,
  onPress,
  onLongPress,
  style,
  scaleValue = 0.96,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}: ScalePressProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability
        if (!reduceMotion) scale.value = withSpring(scaleValue, MOTION.springSnappy);
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability
        if (!reduceMotion) scale.value = withSpring(1, MOTION.springSnappy);
      }}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── 4. StaggerList [UI] ──────────────────────────────────────────────────────

interface StaggerListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  startDelay?: number;
  staggerInterval?: number;
  style?: StyleProp<ViewStyle>;
}

export function StaggerList<T>({
  items,
  renderItem,
  startDelay = 0,
  staggerInterval = MOTION.staggerInterval,
  style,
}: StaggerListProps<T>) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View style={style}>
      {items.map((item, index) => (
        <MotiView
          key={index}
          from={{ opacity: 0, translateY: reduceMotion ? 0 : 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={
            reduceMotion
              ? { type: 'timing', duration: 0 }
              : {
                  type: 'spring',
                  delay: startDelay + index * staggerInterval,
                  damping: MOTION.spring.damping,
                  stiffness: MOTION.spring.stiffness,
                  opacity: {
                    type: 'timing',
                    duration: MOTION.fadeDuration,
                    delay: startDelay + index * staggerInterval,
                  },
                }
          }
        >
          {renderItem(item, index)}
        </MotiView>
      ))}
    </Animated.View>
  );
}

// ─── 5. useCountUp [JS thread] ────────────────────────────────────────────────
// Corre en JS thread porque convierte number→string en render.
// Usar solo en AhorroScreen donde el momento lo justifica.

export function useCountUp(
  targetValue: number,
  duration: number = MOTION.counterDuration,
  startOnMount = true
) {
  const [displayValue, setDisplayValue] = useState(0);
  const reduceMotion = useReducedMotion();
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startOnMount) return;
    if (reduceMotion || targetValue === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayValue(targetValue);
      return;
    }
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayValue(eased * targetValue);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValue, reduceMotion]);

  return displayValue;
}

// ─── 6. PulseAlert [UI] ───────────────────────────────────────────────────────

export function PulseAlert({
  children,
  style,
  cycleDuration = 850,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cycleDuration?: number;
}) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: cycleDuration, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: cycleDuration, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: cycleDuration, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: cycleDuration, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

// ─── 7. TypingIndicator [UI] ──────────────────────────────────────────────────

export function TypingIndicator({ color = '#8B5E3C' }: { color?: string }) {
  const reduceMotion = useReducedMotion();
  const delays = [0, 150, 300];

  return (
    <Animated.View
      style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4 }}
    >
      {delays.map((delayMs, i) => (
        <MotiView
          key={i}
          from={{ translateY: 0 }}
          animate={reduceMotion ? { translateY: 0 } : { translateY: -5 }}
          transition={
            reduceMotion
              ? { type: 'timing', duration: 0 }
              : {
                  type: 'spring',
                  delay: delayMs,
                  damping: 8,
                  stiffness: 220,
                  loop: true,
                  repeatReverse: true,
                }
          }
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: color,
            opacity: 0.65,
          }}
        />
      ))}
    </Animated.View>
  );
}

// ─── 8. RevealText [UI] ───────────────────────────────────────────────────────

export function RevealText({
  children,
  visible,
  style,
}: {
  children: React.ReactNode;
  visible: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <MotiView
          from={{ opacity: 0, scaleY: 0.85, translateY: -8 }}
          animate={{ opacity: 1, scaleY: 1, translateY: 0 }}
          exit={{ opacity: 0, scaleY: 0.85, translateY: -8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 240 }}
          style={style}
        >
          {children}
        </MotiView>
      )}
    </AnimatePresence>
  );
}

// ─── Exports de compatibilidad (legacy) ──────────────────────────────────────
// Mantener para no romper imports existentes en screens que ya usan estos hooks.

export function useFadeInFromBottom(duration = MOTION.fadeDuration, delay = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withSpring(0, MOTION.spring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export function usePulseGlow(cycleDuration = 900) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: cycleDuration, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: cycleDuration, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

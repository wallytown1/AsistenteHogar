import React, { useState, useEffect } from 'react';
import { Animated, ViewStyle } from 'react-native';

// Fade in + rise from below — para cards, recetas, secciones cargadas async
export function useFadeInFromBottom(duration = 400, delay = 0) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(14));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, delay, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { opacity, translateY };
}

// Pulso suave — para badges de caducidad urgente
export function usePulseGlow(cycleDuration = 900) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: cycleDuration, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: cycleDuration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { opacity };
}

// Componente wrapper FadeInView para uso directo en JSX
export function FadeInView({
  children,
  delay = 0,
  duration = 400,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const { opacity, translateY } = useFadeInFromBottom(duration, delay);
  return React.createElement(
    Animated.View,
    { style: [{ opacity, transform: [{ translateY }] }, style] },
    children
  );
}

import React, { useRef, useState } from 'react';
import { View, ScrollView, Pressable, Dimensions, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, radius } from '../theme/tokens';
import { Icon, IconName, AppText, Button } from '../components/ui';
import { haptics } from '../lib/haptics';

const { width: SW, height: SH } = Dimensions.get('window');
const IMAGE_HEIGHT = SH * 0.48;

type Slide = {
  type: 'image' | 'icon';
  image?: ReturnType<typeof require>;
  icon?: IconName;
  accent: string;
  accentSoft: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    type: 'image',
    image: require('../../assets/onboarding/mercado.jpg'),
    accent: colors.brand,
    accentSoft: colors.brandSoft,
    title: 'Deja de\ntirar comida',
    body: 'Aprovecha lo que ya tienes en casa. Menos comida a la basura, más dinero en tu bolsillo.',
  },
  {
    type: 'image',
    image: require('../../assets/onboarding/cocina.jpg'),
    accent: colors.brand,
    accentSoft: colors.brandSoft,
    title: 'Marce cocina\ncon lo que tienes',
    body: 'Fotografía tu nevera o importa el ticket y Marce, tu chef con IA, te dice qué cocinar hoy.',
  },
  {
    type: 'icon',
    icon: 'leaf',
    accent: colors.success,
    accentSoft: colors.successSoft,
    title: 'Mira cuánto\nahorras',
    body: 'El Informe de Ahorro estima en € lo que aprovechas cada mes. Tu progreso, a la vista.',
  },
];

const ONBOARDING_KEY = 'onboarding_seen_v1';

export async function markOnboardingSeen() {
  await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
}

export async function hasSeenOnboarding(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(ONBOARDING_KEY);
  return v === '1';
}

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const insets = useSafeAreaInsets();
  const isLast = page === SLIDES.length - 1;

  const transitionTo = (idx: number) => {
    // Cross-fade entre slides
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      scrollRef.current?.scrollTo({ x: idx * SW, animated: false });
      setPage(idx);
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  const finish = () => {
    haptics.light();
    markOnboardingSeen().then(onDone);
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      haptics.light();
      transitionTo(page + 1);
    }
  };

  const s = SLIDES[page];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* ScrollView sirve solo como contenedor de posición — la transición es via fade */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <Animated.View
            key={i}
            style={{
              width: SW,
              flex: 1,
              opacity: i === page ? fadeAnim : 0,
            }}
          >
            {slide.type === 'image' && slide.image ? (
              <>
                {/* Hero image */}
                <Image
                  source={slide.image}
                  style={{
                    width: SW,
                    height: IMAGE_HEIGHT,
                    resizeMode: 'cover',
                  }}
                />
                {/* Overlay sutil en parte inferior de la imagen */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: IMAGE_HEIGHT * 0.3,
                    // Degradado simulado con opacidad — sin LinearGradient
                    backgroundColor: colors.bg,
                    opacity: 0.45,
                  }}
                  pointerEvents="none"
                />
                {/* Texto debajo de la imagen */}
                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: spacing.xxxl,
                    paddingTop: spacing.xxl,
                    alignItems: 'center',
                  }}
                >
                  <AppText
                    variant="display"
                    center
                    style={{ fontSize: 28, lineHeight: 36, marginBottom: spacing.md }}
                  >
                    {slide.title}
                  </AppText>
                  <AppText variant="body" center color={colors.inkMuted} style={{ lineHeight: 24 }}>
                    {slide.body}
                  </AppText>
                </View>
              </>
            ) : (
              /* Slide de icono (sin imagen) */
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: spacing.xxxl,
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: radius.xxl,
                    backgroundColor: slide.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.xxxl,
                  }}
                >
                  <Icon name={slide.icon!} size={48} color={slide.accent} />
                </View>
                <AppText
                  variant="display"
                  center
                  style={{ fontSize: 30, lineHeight: 38, marginBottom: spacing.md }}
                >
                  {slide.title}
                </AppText>
                <AppText variant="body" center color={colors.inkMuted} style={{ lineHeight: 23 }}>
                  {slide.body}
                </AppText>
              </View>
            )}
          </Animated.View>
        ))}
      </ScrollView>

      {/* Controles */}
      <View
        style={{
          paddingHorizontal: spacing.xxl,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.xl,
          alignItems: 'center',
        }}
      >
        {/* Indicadores de página */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => transitionTo(i)}
              hitSlop={19}
              accessibilityLabel={`Ir a slide ${i + 1}`}
            >
              <View
                style={{
                  height: 6,
                  width: i === page ? 20 : 6,
                  borderRadius: radius.pill,
                  backgroundColor: i === page ? s.accent : colors.track,
                }}
              />
            </Pressable>
          ))}
        </View>

        <Button label={isLast ? 'Empezar' : 'Continuar'} onPress={handleNext} size="lg" />

        {!isLast && (
          <Pressable onPress={finish} hitSlop={8}>
            <AppText variant="caption" color={colors.inkFaint}>
              Saltar
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

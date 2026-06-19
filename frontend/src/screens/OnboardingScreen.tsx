import React, { useRef, useState } from 'react';
import { View, ScrollView, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, radius } from '../theme/tokens';
import { Icon, IconName, AppText, Button } from '../components/ui';
import { haptics } from '../lib/haptics';

const { width: SW } = Dimensions.get('window');

type Slide = {
  icon: IconName;
  accent: string;
  accentSoft: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'home',
    accent: colors.home,
    accentSoft: colors.homeSoft,
    title: 'Tu cocina,\nbien organizada',
    body: 'Gestiona tu despensa, recetas y lista de la compra desde un solo lugar. Todo en tu bolsillo.',
  },
  {
    icon: 'sparkles',
    accent: colors.brand,
    accentSoft: colors.brandSoft,
    title: 'IA que te\nahorra tiempo',
    body: 'Recibe un briefing diario, sugerencias de recetas mediterráneas y añade alimentos con lenguaje natural.',
  },
  {
    icon: 'notifications',
    accent: colors.warning,
    accentSoft: colors.warningSoft,
    title: 'Nada se\ncaduca ni olvida',
    body: 'Alertas antes de que caduquen los alimentos para aprovecharlos en recetas de temporada.',
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
  const insets = useSafeAreaInsets();
  const isLast = page === SLIDES.length - 1;

  const goTo = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * SW, animated: true });
    setPage(idx);
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
      goTo(page + 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View
            key={i}
            style={{
              width: SW,
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
                backgroundColor: s.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.xxxl,
              }}
            >
              <Icon name={s.icon} size={48} color={s.accent} />
            </View>

            <AppText
              variant="display"
              center
              style={{ fontSize: 30, lineHeight: 38, marginBottom: spacing.md }}
            >
              {s.title}
            </AppText>
            <AppText variant="body" center color={colors.inkMuted} style={{ lineHeight: 23 }}>
              {s.body}
            </AppText>
          </View>
        ))}
      </ScrollView>

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
              onPress={() => goTo(i)}
              hitSlop={19}
              accessibilityLabel={`Ir a slide ${i + 1}`}
            >
              <View
                style={{
                  height: 6,
                  width: i === page ? 20 : 6,
                  borderRadius: radius.pill,
                  backgroundColor: i === page ? colors.brand : colors.track,
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

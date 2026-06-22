import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/tokens';
import { AppText, Icon } from '../components/ui';
import AIDisclaimerBanner from '../components/AIDisclaimerBanner';
import { useChefChat } from '../hooks/useChefChat';
import { ChefMensaje } from '../types/types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { haptics } from '../lib/haptics';
import RecipeChatCard from '../components/chat/RecipeChatCard';

function Burbuja({ mensaje }: { mensaje: ChefMensaje }) {
  const esUsuario = mensaje.rol === 'usuario';
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <View style={[styles.bubbleRow, { justifyContent: esUsuario ? 'flex-end' : 'flex-start' }]}>
      <View style={{ flex: 1, alignItems: esUsuario ? 'flex-end' : 'flex-start' }}>
        <View style={[styles.bubble, esUsuario ? styles.bubbleUser : styles.bubbleChef]}>
          <AppText
            variant="body"
            color={esUsuario ? colors.onBrand : colors.ink}
            style={styles.bubbleText}
          >
            {mensaje.texto}
          </AppText>
        </View>

        {!esUsuario && mensaje.platos && mensaje.platos.length > 0 && (
          <View style={styles.platosContainer}>
            {mensaje.platos.map((plato, idx) => (
              <RecipeChatCard
                key={idx}
                receta={plato}
                onPress={() => navigation.navigate('RecetaDetalle', { receta: plato })}
              />
            ))}
          </View>
        )}

        {!esUsuario && mensaje.consumos_aplicados && mensaje.consumos_aplicados.length > 0 && (
          <View style={styles.consumosContainer}>
            {mensaje.consumos_aplicados.map((consumo, idx) => (
              <View key={idx} style={styles.consumoTag}>
                <Icon name="checkmark-circle" size={12} color={colors.success} />
                <AppText variant="micro" color={colors.success} style={{ marginLeft: 4 }}>
                  {consumo}
                </AppText>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function ChefChatScreen() {
  const { mensajes, enviando, enviar } = useChefChat();
  const [texto, setTexto] = useState('');
  const listRef = useRef<FlatList<ChefMensaje>>(null);

  const onEnviar = () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    haptics.light();
    setTexto('');
    enviar(limpio);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Icon name="restaurant" size={18} color={colors.onBrand} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="h2">Marce</AppText>
          <AppText variant="caption" color={colors.inkFaint}>
            Tu chef de confianza
          </AppText>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={mensajes}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <Burbuja mensaje={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <AIDisclaimerBanner texto="Marce es un asistente de IA y puede equivocarse." />
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {enviando && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={colors.brand} />
            <AppText variant="caption" color={colors.inkFaint} style={{ marginLeft: spacing.sm }}>
              Marce está pensando…
            </AppText>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe a Marce…"
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={1000}
            editable={!enviando}
            onSubmitEditing={onEnviar}
            returnKeyType="send"
          />
          <Pressable
            onPress={onEnviar}
            disabled={enviando || !texto.trim()}
            style={[styles.sendBtn, (enviando || !texto.trim()) && styles.sendBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
          >
            <Icon name="send" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
  },
  bubbleUser: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: radius.sm,
  },
  bubbleChef: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: { lineHeight: 21 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.ink,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  platosContainer: {
    marginTop: spacing.xs,
    width: '100%',
    paddingRight: '18%', // keep it aligned with max width of bubble
  },
  consumosContainer: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  consumoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});

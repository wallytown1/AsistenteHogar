import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../theme/tokens';
import { AppText, IconButton } from '../components/ui';

/**
 * Pantalla de documentos legales en la app (RGPD art. 13, LSSI art. 10, LGDCU).
 *
 * IMPORTANTE — pendiente del fundador antes del lanzamiento:
 * los campos marcados como [COMPLETAR] requieren datos reales de la entidad
 * (razón social, NIF, domicilio, email de contacto/DPD) y la confirmación del
 * abogado. El texto es una base de cumplimiento, no asesoramiento legal.
 */

type Documento = 'privacidad' | 'terminos' | 'legal';

type LegalRoute = RouteProp<{ Legal: { documento: Documento } }, 'Legal'>;

const TITULOS: Record<Documento, string> = {
  privacidad: 'Política de Privacidad',
  terminos: 'Términos de Servicio',
  legal: 'Información Legal',
};

function H({ children }: { children: string }) {
  return (
    <AppText variant="h2" style={styles.h}>
      {children}
    </AppText>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="caption" color={colors.inkMuted} style={styles.p}>
      {children}
    </AppText>
  );
}

function Privacidad() {
  return (
    <>
      <P>
        Última actualización: [COMPLETAR fecha]. Responsable del tratamiento: [COMPLETAR razón
        social], NIF [COMPLETAR], con domicilio en [COMPLETAR]. Contacto de privacidad: [COMPLETAR
        email].
      </P>

      <H>1. Qué datos tratamos</H>
      <P>
        · Cuenta: email y nombre. {'\n'}· Despensa y hogar: alimentos, cantidades, fechas de
        caducidad, preferencias culinarias y número de comensales. {'\n'}· Contenido que nos envías
        para procesar con IA: fotos de tu nevera/despensa, PDFs de tickets de compra y texto o voz
        que dictas para añadir productos. {'\n'}· Datos de uso técnicos necesarios para el servicio
        (identificadores de sesión).
      </P>

      <H>2. Para qué los usamos y base legal</H>
      <P>
        Tratamos tus datos para prestarte el servicio (ejecución del contrato, art. 6.1.b RGPD):
        identificar productos, gestionar tu despensa, sugerir recetas y calcular tu Informe de
        Ahorro. No vendemos tus datos ni los usamos para publicidad de terceros.
      </P>

      <H>3. Inteligencia artificial y proveedores</H>
      <P>
        Para las funciones de IA usamos modelos de Google (Gemini). Las imágenes, los PDFs de
        tickets y los textos que envías se transmiten a Google como encargado del tratamiento para
        generar la respuesta. Esto puede implicar una transferencia internacional de datos amparada
        en las garantías del proveedor (cláusulas contractuales tipo / DPA de Google Cloud).
        [COMPLETAR: confirmar DPA firmado.]
      </P>
      <P>
        No introduzcas en la app datos de categorías especiales (salud, religión, etc.). El campo de
        preferencias culinarias es solo para gustos, no para alergias médicas.
      </P>

      <H>4. Cuánto tiempo los conservamos</H>
      <P>
        Conservamos tus datos mientras tu cuenta esté activa. El historial de movimientos de la
        despensa se purga de forma periódica. Si eliminas tu cuenta desde Ajustes, se destruyen de
        forma permanente el hogar y todos sus datos asociados.
      </P>

      <H>5. Tus derechos</H>
      <P>
        Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y
        portabilidad escribiendo a [COMPLETAR email]. Puedes eliminar tu cuenta y todos tus datos
        directamente desde Ajustes → Zona de peligro. Si consideras que no hemos atendido tu
        solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).
      </P>
    </>
  );
}

function Terminos() {
  return (
    <>
      <P>Última actualización: [COMPLETAR fecha].</P>

      <H>1. Edad mínima</H>
      <P>
        Este servicio está dirigido a personas mayores de 14 años. Si eres menor de esa edad, no
        debes usar la app sin el consentimiento de quien ostente tu patria potestad o tutela.
      </P>

      <H>2. El servicio</H>
      <P>
        AsistenteHogar te ayuda a gestionar tu despensa, evitar el desperdicio y cocinar con lo que
        tienes. Las sugerencias de recetas, las estimaciones de caducidad y el Informe de Ahorro se
        generan, en parte, con inteligencia artificial y son orientativas: pueden contener errores y
        no sustituyen tu propio criterio, especialmente en materia de seguridad alimentaria o
        alergias.
      </P>

      <H>3. Suscripciones</H>
      <P>
        Los planes Premium y Familia son suscripciones de pago recurrente. El precio aplicable, con
        los impuestos incluidos (IVA), se muestra en la pantalla de compra antes de confirmar. La
        suscripción se renueva automáticamente al final de cada periodo salvo que la canceles al
        menos 24 horas antes de la renovación, desde los ajustes de tu cuenta de App Store (iOS) o
        Google Play (Android). El cobro y la gestión de la suscripción los realiza la tienda de
        aplicaciones correspondiente.
      </P>
      <P>
        Derecho de desistimiento: al tratarse de contenido y servicios digitales de ejecución
        inmediata, al suscribirte solicitas y aceptas el inicio inmediato de la prestación; el
        reembolso, cuando proceda, se rige por las políticas de App Store o Google Play.
      </P>

      <H>4. Uso responsable</H>
      <P>
        Te comprometes a usar la app de forma lícita y a no subir contenido de terceros sin permiso.
        Podemos suspender cuentas que abusen del servicio o de las funciones de IA.
      </P>
    </>
  );
}

function Legal() {
  return (
    <>
      <P>Información facilitada en cumplimiento del art. 10 de la LSSI-CE.</P>
      <H>Titular del servicio</H>
      <P>
        Denominación: [COMPLETAR razón social] {'\n'}
        NIF: [COMPLETAR] {'\n'}
        Domicilio: [COMPLETAR] {'\n'}
        Correo electrónico de contacto: [COMPLETAR] {'\n'}
        Actividad: aplicación móvil de gestión de despensa y reducción del desperdicio alimentario.
      </P>
    </>
  );
}

export default function LegalScreen() {
  const route = useRoute<LegalRoute>();
  const navigation = useNavigation();
  const documento = route.params?.documento ?? 'privacidad';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => navigation.goBack()} />
        <AppText variant="h2" style={styles.headerTitle}>
          {TITULOS[documento]}
        </AppText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {documento === 'privacidad' && <Privacidad />}
        {documento === 'terminos' && <Terminos />}
        {documento === 'legal' && <Legal />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  h: { marginTop: spacing.lg, marginBottom: spacing.xs },
  p: { lineHeight: 20, marginBottom: spacing.sm },
});

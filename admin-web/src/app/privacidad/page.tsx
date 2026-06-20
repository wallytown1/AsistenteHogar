export const metadata = {
  title: "Política de Privacidad — Fogón",
  description: "Política de privacidad de la aplicación Fogón",
};

export default function PrivacidadPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-10">
        Aplicación <strong>Fogón</strong> · Última actualización: 20 de junio de 2026
      </p>

      <Section title="1. Responsable del tratamiento">
        <p>
          El responsable del tratamiento de sus datos personales es el desarrollador de la
          aplicación <strong>Fogón</strong>, contactable en{" "}
          <a href="mailto:navaroruiz2000@gmail.com" className="text-indigo-600 underline">
            navaroruiz2000@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section title="2. Datos que recopilamos">
        <p className="mb-3">Recopilamos exclusivamente los datos necesarios para el funcionamiento de la app:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Cuenta:</strong> nombre, email y contraseña (almacenada con hash bcrypt).</li>
          <li><strong>Hogar:</strong> nombre del hogar y perfiles individuales de convivientes (gustos culinarios, sin datos de salud).</li>
          <li><strong>Despensa:</strong> alimentos, cantidades, fechas de caducidad y categorías.</li>
          <li><strong>Historial:</strong> recetas marcadas como cocinadas o rechazadas.</li>
          <li><strong>Lista de la compra:</strong> productos pendientes de comprar.</li>
          <li><strong>Onboarding:</strong> preferencias culinarias del hogar y número de comensales.</li>
        </ul>
        <p className="mt-3">
          No recopilamos datos de salud sensibles (alergias médicas, intolerancias) conforme
          al artículo 9 del RGPD.
        </p>
      </Section>

      <Section title="3. Finalidad y base legal">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Prestación del servicio</strong> (art. 6.1.b RGPD): gestión de la despensa,
            sugerencia de recetas mediterráneas, planificación de menús y lista de la compra.
          </li>
          <li>
            <strong>Mejora personalizada</strong> (art. 6.1.b RGPD): el historial de recetas
            cocinadas/rechazadas se usa para afinar las sugerencias de IA dentro de la misma cuenta.
          </li>
          <li>
            <strong>Obligación legal</strong> (art. 6.1.c RGPD): registros mínimos de borrado para
            cumplimiento RGPD art. 17.
          </li>
        </ul>
      </Section>

      <Section title="4. Inteligencia artificial (Gemini)">
        <p className="mb-3">
          Las funciones de IA (sugerencia de recetas, interpretación de audio, análisis de ticket OCR,
          foto de nevera y planificación semanal) utilizan la API de{" "}
          <strong>Google Gemini</strong> con una cuenta de facturación activa. Esto significa que
          Google <strong>no usa sus datos para mejorar sus modelos</strong> (cláusula de
          no-entrenamiento del plan de pago, equivalente a un DPA).
        </p>
        <p>
          Los datos enviados a Gemini se limitan al contenido de su despensa y preferencias
          culinarias. Nunca se envían nombre, email ni contraseña.
        </p>
      </Section>

      <Section title="5. Encargados del tratamiento (terceros)">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Google LLC</strong> (Gemini API) — procesamiento de IA. Consulte la{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline"
            >
              política de privacidad de Google
            </a>
            .
          </li>
          <li>
            <strong>RevenueCat Inc.</strong> — gestión de suscripciones premium. Solo recibe un
            identificador de usuario anónimo. Consulte la{" "}
            <a
              href="https://www.revenuecat.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline"
            >
              política de RevenueCat
            </a>
            .
          </li>
          <li>
            <strong>Railway</strong> — alojamiento del servidor y base de datos PostgreSQL.
          </li>
        </ul>
      </Section>

      <Section title="6. Conservación de datos">
        <ul className="list-disc pl-6 space-y-1">
          <li>Los datos se conservan mientras la cuenta esté activa.</li>
          <li>
            Al eliminar la cuenta (<em>Ajustes → Zona de peligro → Eliminar cuenta</em>), todos los
            datos del hogar se borran de forma permanente e inmediata mediante cascada en base de datos.
          </li>
          <li>
            Los registros marcados como eliminados (soft-delete) se purgan físicamente de manera
            automática a los 30 días.
          </li>
        </ul>
      </Section>

      <Section title="7. Sus derechos (RGPD arts. 15–22)">
        <p className="mb-3">Tiene derecho a:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Acceso</strong> a sus datos personales.</li>
          <li><strong>Rectificación</strong> de datos inexactos.</li>
          <li><strong>Supresión</strong> («derecho al olvido»): elimine su cuenta desde la app.</li>
          <li><strong>Portabilidad</strong>: solicite exportación de sus datos por email.</li>
          <li><strong>Oposición</strong> al tratamiento basado en interés legítimo.</li>
          <li>
            <strong>Reclamación</strong> ante la Agencia Española de Protección de Datos (
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline"
            >
              aepd.es
            </a>
            ).
          </li>
        </ul>
        <p className="mt-3">
          Para ejercer cualquier derecho, contacte en{" "}
          <a href="mailto:navaroruiz2000@gmail.com" className="text-indigo-600 underline">
            navaroruiz2000@gmail.com
          </a>
          . Responderemos en un plazo máximo de 30 días.
        </p>
      </Section>

      <Section title="8. Seguridad">
        <p>
          Los datos se transmiten cifrados mediante HTTPS/TLS. Las contraseñas se almacenan con
          hash bcrypt. Los tokens JWT se invalidan al cerrar sesión mediante una lista de
          revocación en Redis.
        </p>
      </Section>

      <Section title="9. Cambios en esta política">
        <p>
          Cualquier cambio sustancial se notificará mediante aviso en la aplicación con al menos
          15 días de antelación. La fecha de última actualización figura en el encabezado de este
          documento.
        </p>
      </Section>

      <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500 flex gap-6">
        <a href="/terminos" className="text-indigo-600 underline">
          Términos y Condiciones
        </a>
        <a href="mailto:navaroruiz2000@gmail.com">navaroruiz2000@gmail.com</a>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-sm leading-relaxed text-gray-700 space-y-2">{children}</div>
    </section>
  );
}

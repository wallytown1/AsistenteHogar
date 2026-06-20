export const metadata = {
  title: "Términos y Condiciones — Fogón",
  description: "Términos y condiciones de uso de la aplicación Fogón",
};

export default function TerminosPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Términos y Condiciones</h1>
      <p className="text-sm text-gray-500 mb-10">
        Aplicación <strong>Fogón</strong> · Última actualización: 20 de junio de 2026
      </p>

      <Section title="1. Objeto y aceptación">
        <p>
          Los presentes términos regulan el uso de la aplicación móvil <strong>Fogón</strong>{" "}
          («la App»), una herramienta de gestión de despensa y sugerencia de recetas mediterráneas
          para el hogar familiar. Al crear una cuenta, el usuario acepta estos términos en su
          totalidad.
        </p>
      </Section>

      <Section title="2. Acceso y registro">
        <ul className="list-disc pl-6 space-y-1">
          <li>La App es de uso personal y familiar; una cuenta corresponde a un hogar.</li>
          <li>El usuario debe tener al menos 16 años para registrarse.</li>
          <li>
            El usuario es responsable de mantener sus credenciales seguras y de toda la actividad
            que se produzca bajo su cuenta.
          </li>
          <li>
            No está permitido crear cuentas de forma automatizada ni utilizar la App para fines
            comerciales sin autorización expresa.
          </li>
        </ul>
      </Section>

      <Section title="3. Planes y suscripciones">
        <p className="mb-3">Fogón ofrece tres niveles de acceso:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Gratuito:</strong> gestión básica de despensa y acceso al catálogo de recetas
            estático.
          </li>
          <li>
            <strong>Premium:</strong> recetas generadas por IA, análisis de ticket OCR y foto de
            nevera.
          </li>
          <li>
            <strong>Familia:</strong> incluye Premium más planificación semanal de menús y perfiles
            individuales por conviviente.
          </li>
        </ul>
        <p className="mt-3">
          Las suscripciones se gestionan a través de <strong>RevenueCat</strong> y las tiendas de
          aplicaciones (App Store / Google Play). Los precios vigentes se muestran en la pantalla de
          suscripción de la App. Las suscripciones se renuevan automáticamente salvo cancelación
          antes del fin del período en curso. Las políticas de reembolso se rigen por las normas de
          Apple App Store y Google Play Store.
        </p>
      </Section>

      <Section title="4. Funciones de inteligencia artificial">
        <p>
          Las sugerencias de recetas, la interpretación de audio, el análisis OCR de tickets y la
          foto de nevera son generadas mediante IA (Google Gemini). Estas sugerencias son
          orientativas y no sustituyen el criterio del usuario. Fogón no garantiza la exactitud,
          idoneidad o disponibilidad de los ingredientes sugeridos.
        </p>
        <p className="mt-2">
          Las recetas siguen una filosofía mediterránea española tradicional. La App muestra un
          distintivo de transparencia («Generado con IA») en todo contenido producido por el modelo.
        </p>
      </Section>

      <Section title="5. Propiedad intelectual">
        <p>
          El código fuente, diseño, marca y contenido estático de Fogón son propiedad del
          desarrollador. El contenido generado por IA a partir de los datos del usuario
          (recetas, planes de menú) se considera creado para uso exclusivo del hogar y no puede
          redistribuirse comercialmente.
        </p>
      </Section>

      <Section title="6. Limitación de responsabilidad">
        <p>
          Fogón se proporciona «tal cual». El desarrollador no será responsable de daños derivados
          del uso de la App, pérdida de datos por causas ajenas al servicio, ni de decisiones
          tomadas en base a las sugerencias de la IA. La disponibilidad del servicio no se garantiza
          al 100 %.
        </p>
      </Section>

      <Section title="7. Eliminación de cuenta">
        <p>
          El usuario puede eliminar su cuenta y todos sus datos en cualquier momento desde{" "}
          <em>Ajustes → Zona de peligro → Eliminar cuenta</em>. Esta acción es irreversible y
          elimina permanentemente todos los datos del hogar.
        </p>
      </Section>

      <Section title="8. Modificaciones">
        <p>
          El desarrollador se reserva el derecho a modificar estos términos. Los cambios
          sustanciales se notificarán con al menos 15 días de antelación mediante aviso en la App.
          El uso continuado de la App tras ese plazo implica la aceptación de los nuevos términos.
        </p>
      </Section>

      <Section title="9. Legislación aplicable">
        <p>
          Estos términos se rigen por la legislación española. Para cualquier controversia, las
          partes se someten a los juzgados y tribunales del domicilio del usuario, conforme a la
          normativa de consumidores y usuarios.
        </p>
      </Section>

      <Section title="10. Contacto">
        <p>
          Para cualquier consulta sobre estos términos:{" "}
          <a href="mailto:soporte@fogon.app" className="text-indigo-600 underline">
            soporte@fogon.app
          </a>
        </p>
      </Section>

      <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500 flex gap-6">
        <a href="/privacidad" className="text-indigo-600 underline">
          Política de Privacidad
        </a>
        <a href="mailto:soporte@fogon.app">soporte@fogon.app</a>
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

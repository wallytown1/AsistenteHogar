---
trigger: always_on
---

# 00_PROJECT_MASTER_BLUEPRINT: Asistente del Hogar IA
**Estatus del Documento:** Master / Inicialización de Entorno
**Ecosistema de Destino:** Plataforma Antigravity (Agentes: Frontend-Dev, Backend-Dev, IA-Dev)
**Referencia de Arquitectura:** 01_CONTEXTO_Y_ARQUITECTURA_APP.md

---

## 1. Visión General del Proyecto
El Asistente del Hogar IA es un ecosistema inteligente concebido para centralizar, optimizar y gestionar las dinámicas operativas de un núcleo familiar a través de una interfaz unificada.

* **Propósito:** Transformar la gestión del hogar mediante un núcleo de inteligencia artificial que actúe de forma consultiva, organizando el caos diario sin usurpar el control del usuario.
* **Modelo de Acceso:** Cuenta única familiar compartida, donde todos los miembros interactúan con el mismo estado de datos para garantizar la sincronización en tiempo real.
* **Idioma Nativo:** Español (todas las interfaces, respuestas de IA y logs de negocio).

---

## 2. Arquitectura y Stack Tecnológico
El proyecto está diseñado bajo una arquitectura desacoplada, priorizando la velocidad de respuesta, el tipado estricto y la facilidad de despliegue para los subagentes de Antigravity.

| Capa de Software | Tecnología Principal | Enfoque y Restricciones |
| :--- | :--- | :--- |
| **Frontend** | React Native + Expo + Tailwind CSS | Aplicación móvil nativa fluida, componentes modulares y diseño limpio. |
| **Backend** | Python + FastAPI | API REST asíncrona de alto rendimiento, modular y autodocumentada. |
| **Base de Datos** | PostgreSQL | Almacenamiento relacional sólido con diseño de tablas optimizado para concurrencia familiar. |

---

## 3. Alcance del MVP (Módulos Core)
El Producto Mínimo Viable se centra en tres pilares operativos fundamentales que resuelven las fricciones más comunes del día a día doméstico:

* **📑 Dashboard (Briefing de Texto):**
    * *Función:* Pantalla principal que ofrece un resumen ejecutivo diario, consolidando las novedades del hogar.
    * *Mecánica IA:* Procesamiento en texto plano que analiza el estado actual de la despensa y el calendario para generar un "briefing" matutino amigable y procesable.
* **🥫 Despensa (Inventario y Caducidades):**
    * *Función:* Sistema de control de existencias de alimentos, insumos y productos del hogar.
    * *Mecánica Técnica:* Monitoreo activo de fechas de vencimiento con alertas inteligentes ante productos próximos a caducar, facilitando la planificación de compras.
* **📅 Calendario (Gestión de Conflictos):**
    * *Función:* Agenda compartida para la sincronización de eventos, citas y tareas de los miembros de la familia.
    * *Mecánica Técnica:* Algoritmos de detección automática de solapamientos horarios o conflictos de logística familiar, notificando visualmente al usuario para su resolución manual.

---

## 4. Filosofía de Seguridad e IA (Líneas Rojas Obligatorias)
Para garantizar la integridad del sistema y una experiencia de usuario segura, el entorno de Antigravity debe aplicar de forma estricta las siguientes políticas de desarrollo:

* **Regla de IA Pasiva:** La IA opera bajo un modelo estrictamente consultivo. Tiene prohibido mutar, crear, editar o eliminar registros de la base de datos de manera autónoma; cualquier acción de escritura requiere confirmación expresa y manual del usuario en el cliente.
* **Temperatura Cero (Creatividad = 0):** Todos los endpoints backend que ejecuten funciones de base de datos o lógica de negocio crítica con modelos de lenguaje deben fijar la temperatura obligatoriamente en 0 para asegurar respuestas deterministas y consistentes.
* **Validación de Datos con Pydantic:** Es obligatorio que cada entrada y salida de los endpoints del backend esté rigurosamente tipada y validada mediante esquemas de Pydantic. No se procesarán payloads crudos o no estructurados.
* **Sanitización Preventiva:** Antes de enviar cualquier payload o contexto a las APIs de LLM externas, los datos deben ser sanitizados para proteger la privacidad familiar y evitar inyecciones de código o prompts no deseados.
* **Estructuración XML:** Las instrucciones técnicas complejas dirigidas a los agentes deben estructurarse utilizando etiquetas XML (`<instructions>`, `<code>`, `<constraints>`) para compartimentar adecuadamente el contexto y optimizar el procesamiento.
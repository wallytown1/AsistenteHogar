# Claude Code - Implementación de Compliance Legal

## Objetivo Core
Refactorizar el código del monorepo **Asistente del Hogar IA** para implementar los requisitos técnicos del RGPD, la Ley de IA de la UE y las políticas de las tiendas de aplicaciones. Céntrate exclusivamente en escribir, modificar e integrar el código necesario. No redactes explicaciones teóricas.

## 1. Tareas de Backend (`backend/`)
Ejecuta las siguientes implementaciones en la API de FastAPI y la base de datos PostgreSQL:

*   **Purga Física (RGPD):** Crea un mecanismo (script o función programada) apoyándote en `backend/app/repositories/` que ejecute un `DELETE` físico para todos los registros (inventario, tareas, eventos) donde `is_deleted = true` y `updated_at` sea mayor a 30 días.
*   **Anonimización LLM:** Modifica la lógica en `backend/app/services/` que alimenta el endpoint `GET /api/v1/hogares/{hogar_id}/briefing`. Implementa un tokenizador que reemplace los nombres propios de los participantes por identificadores genéricos (ej. `Familiar_1`) en el prompt que va al LLM. Revierte los tokens al texto original al recibir la respuesta.
*   **Endpoint de Destrucción (App Store):** Añade la ruta `DELETE /api/v1/hogares/{hogar_id}/usuarios/cuenta` en `backend/app/api/routers/`. Debe ejecutar una eliminación física y definitiva (`ON DELETE CASCADE`) del hogar y toda su información vinculada. Actualiza `backend/app/schemas/` si es necesario.

## 2. Tareas de Frontend (`frontend/`)
Ejecuta las siguientes implementaciones en la app de Expo/React Native:

*   **Banner de Transparencia IA:** Crea un componente de advertencia en `frontend/src/components/` usando NativeWind. El texto fijo debe ser: *"Este resumen ha sido generado por IA y puede contener imprecisiones."* Inyecta este componente en la pantalla correspondiente dentro de `frontend/src/screens/` donde se renderiza el briefing diario.
*   **Flujo de Eliminación de Cuenta:** En la pantalla de ajustes/perfil, añade un botón destructivo ("Eliminar cuenta permanentemente").
*   **Integración de Estado:** Crea una acción en Zustand (`frontend/src/state/`) que conecte ese botón. Debe:
    1. Lanzar una alerta de confirmación nativa irreversible.
    2. Consumir el nuevo endpoint `DELETE` del backend.
    3. Limpiar el estado global y el almacenamiento local.
    4. Desmontar la sesión y navegar al Login.

## Reglas de Ejecución
*   Usa las herramientas `Read` y `View` para analizar la arquitectura actual antes de modificar archivos.
*   Asegúrate de que las firmas de las funciones y los tipos de TypeScript/Python coincidan con la arquitectura establecida.
*   Genera y aplica los parches de código directamente.
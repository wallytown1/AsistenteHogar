# Asistente del Hogar IA

Bienvenido al repositorio principal de la plataforma **Asistente del Hogar IA**, un ecosistema inteligente diseñado para gestionar hogares, despensas, calendarios y tareas familiares.

## Estructura del Monorepo

*   **`backend/`**: Servidor FastAPI asíncrono con base de datos (PostgreSQL/SQLite) y SQLAlchemy. Controla la lógica central, autenticación JWT multi-tenant, e integración con el modelo Gemini LLM.
*   **`frontend/`**: Aplicación móvil multiplataforma (React Native / Expo) utilizada por los usuarios finales para interactuar con la plataforma y recibir reportes matutinos inteligentes.
*   **`admin-web/`** *(NUEVO)*: **Panel de Control God Mode** para administradores. Construido en React 18 y Vite, con un diseño "Premium Dark Mode Glassmorphism".

## Ejecución del Panel de Administrador (God Mode)

Para arrancar el panel de administración, necesitas tener configurada tu **Contraseña Maestra**:

1.  En el backend (archivo `.env` local o en las variables de entorno de producción en Railway), define:
    ```bash
    ADMIN_API_KEY=TuContraseñaSecreta123
    ```
2.  En la carpeta `admin-web`, crea un archivo `.env` apuntando a tu backend:
    ```bash
    VITE_API_URL=https://nurturing-tranquility-production.up.railway.app/api/v1
    ```
3.  Arranca la web:
    ```bash
    cd admin-web
    npm run dev
    ```
4.  Visita `http://localhost:5173` y accede usando la contraseña maestra que configuraste.

## Documentación Técnica

Toda la arquitectura, estado de las fases, contratos de endpoints y cumplimiento legal (RGPD) se encuentra detalladamente explicada en los siguientes archivos Markdown de la raíz:

*   [01_CONTEXTO_Y_ARQUITECTURA_APP.md](./01_CONTEXTO_Y_ARQUITECTURA_APP.md)
*   [ENDPOINTS.md](./ENDPOINTS.md)
*   [ESTADO_ACTUAL.md](./ESTADO_ACTUAL.md)
*   [LEGALIDAD.md](./LEGALIDAD.md)
*   [CHANGELOG.md](./CHANGELOG.md)

## Flujo de Trabajo

El flujo de trabajo actual se basa en la creación de **una rama nueva para cada Feature**, realizando los Pull Requests hacia `main` tras su finalización. Revisa el archivo [AGENTS.md](./AGENTS.md) si eres un Asistente IA.

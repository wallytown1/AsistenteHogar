# ARCHITECTURE_MAP — Asistente del Hogar IA (app de comida)

> App **exclusiva de comida, stock y recetas mediterráneas españolas**. Tras el
> Pivote 2 se eliminaron los módulos de Eventos (calendario) y Tareas (domésticas).
> Núcleo: stock real de la despensa → recetas de aprovechamiento personalizadas.

## Mapa de sistema

```mermaid
graph TB
    subgraph Cliente["📱 App móvil (Expo / React Native)"]
        Home["Inicio — briefing + 3 tarjetas de receta"]
        Desp["Despensa — stock + foto nevera + ticket + voz"]
        Chat["Chat con el Chef (futuro)"]
        Ajustes["Ajustes + Perfiles"]
    end

    subgraph Admin["🖥️ Panel Admin (Next.js — admin-web/) [Fase 2]"]
        AdmRec["CRUD Recetario Maestro"]
        AdmPrompt["Editor de Prompts / System Instructions"]
        AdmAuth["Login super-admin (auth separada)"]
    end

    subgraph API["⚙️ Backend FastAPI"]
        RAuth["/auth (familias, JWT)"]
        RAdmin["/admin/* (super-admin, JWT admin) [Fase 2]"]
        RPantry["/pantry/* (stock, recetas, foto, ticket, voz)"]
        RDash["/dashboard (briefing despensa)"]
        RPerfil["/onboarding (perfil hogar)"]
        RPerfilInd["/perfiles (perfiles individuales) [Fase 3] ✅"]
        RHist["/pantry/recetas/historial"]
        RLista["/lista-compra (CRUD lista compra) ✅"]
        PromptSvc["PromptConfigService (caché TTL) [Fase 2]"]
        LLM["services/llm.py (_call_gemini)"]
        Premium["premium.py (gate premium)"]
    end

    subgraph DB["🗄️ PostgreSQL"]
        Thog["hogares / usuarios"]
        Tstock["inventario_alimentos"]
        Tperfh["perfil_hogar (logística)"]
        Tperfi["perfil_individual [Fase 3]"]
        Thist["recetas_historial"]
        Trec["recetario_maestro (GLOBAL) [Fase 2]"]
        Tprompt["prompt_templates (GLOBAL) [Fase 2]"]
        Tadmin["admin_users (GLOBAL) [Fase 2]"]
        Tborr["registros_borrado (RGPD)"]
        Tlista["lista_compra (por hogar) ✅"]
    end

    Gemini["☁️ Gemini 2.5 Flash<br/>structured output · vision · context caching [Fase 4]"]
    RC["💳 RevenueCat<br/>Free / Premium1 / Premium2"]

    Home & Desp & Chat & Ajustes -->|Bearer JWT familia| API
    AdmRec & AdmPrompt -->|Bearer JWT admin| RAdmin
    AdmAuth --> RAdmin
    RAdmin --> Trec & Tprompt
    RPantry & RDash --> LLM
    LLM --> PromptSvc
    PromptSvc -->|lee con caché| Tprompt
    LLM -->|recetario en context cache| Gemini
    RPantry --> Premium
    Premium -->|valida entitlement| RC
    RPerfil --> Tperfh
    RPerfilInd --> Tperfi
    RPantry --> Tstock
    RHist --> Thist
    RLista --> Tlista
    RDash --> Tstock
```

## Modelo de datos

```mermaid
erDiagram
    HOGARES ||--o{ USUARIOS : tiene
    HOGARES ||--o{ INVENTARIO_ALIMENTOS : posee
    HOGARES ||--|| PERFIL_HOGAR : "logística (1:1)"
    HOGARES ||--o{ PERFIL_INDIVIDUAL : "paladar culinario (0..10) [Fase 3] ✅"
    HOGARES ||--o{ RECETAS_HISTORIAL : registra
    RECETARIO_MAESTRO }o--o{ RECETAS_HISTORIAL : "referencia (global) [Fase 2]"
    PROMPT_TEMPLATES }o..o{ HOGARES : "global, sin hogar_id [Fase 2]"
    ADMIN_USERS }o..o{ PROMPT_TEMPLATES : "edita [Fase 2]"
```

Tablas vivas hoy: `hogares`, `usuarios`, `inventario_alimentos`, `perfil_hogar`,
`perfiles_individuales` (migración `a5b3c1d9e7f2`, Fase 3 — máx. 10 por hogar, soft delete),
`recetas_historial`, `lista_compra` (migración `c6d8f0a1b2e3`), `registros_borrado`,
`admin_users`, `prompt_templates`, `recetario_maestro` (las tres últimas globales, sin
`hogar_id`, añadidas en Fase 2 — migración `e1f3a5c70d84`).
Eliminadas en el Pivote 2: `eventos_calendario`, `tareas_hogar` (migración `d3e5f7b91a26`).

## Flujos clave

```mermaid
sequenceDiagram
    participant U as Usuario
    participant App as App
    participant API as Backend
    participant G as Gemini

    Note over U,G: Flujo A — Onboarding "Foto de Nevera"
    U->>App: Foto de la nevera
    App->>API: POST /pantry/foto-nevera (base64)
    API->>G: Vision: detecta ingredientes
    G-->>API: alimentos + sugerencias_rapidas
    API-->>App: propuesta (IA asistida, el usuario confirma)
    App->>API: POST /pantry (confirma) + básicos auto (aceite, sal, ajo, cebolla)
    App-->>U: Home con 3 tarjetas de receta
```

- **Flujo B (Ticket + planificador, Premium2):** foto ticket → normaliza
  abreviaturas del súper → actualiza stock → menú 7 días encadenando
  aprovechamiento (Lunes cocido → Martes ropa vieja).
- **Flujo C (Depleción + feedback):** "Terminar receta" descuenta stock estimado
  con confirmación ligera; micro-preguntas A/B (máx. cada 3 días) afinan el perfil.

## Modelo de monetización (RevenueCat)

| Tier | Precio | Incluye |
|---|---|---|
| **Free** | 0 € | Recetario maestro + stock manual + 3-5 créditos IA/mes |
| **Premium 1** | 1,99 €/mes | Escaneo de tickets, foto de nevera y chat con el chef ilimitados |
| **Premium 2** | 4,99 €/mes | Todo lo anterior + planificador semanal de aprovechamiento + analítica nutricional invisible |

## Estado por fases

- **Fase 1 (hecha):** demolición Eventos+Tareas, app 100% comida, docs + este mapa.
- **Fase 2 (hecha):** `recetario_maestro` + `prompt_templates` dinámicos desde BD con caché TTL + panel admin Next.js (`admin-web/`). Commit `92609b5`.
- **Fase 3 (hecha):** `perfiles_individuales` — preferencias culinarias por miembro del hogar (solo datos gastronómicos, no alergias médicas — RGPD art. 9). CRUD completo + límite 10/hogar + aislamiento multi-tenant + inyección en prompts LLM. Commit `8107fe5`.
- **Fase 4 (hecha):** `_bloque_recetario` en `llm.py` inyecta hasta 15 recetas del `recetario_maestro` en los prompts. `seed_recetario.py` carga 15 recetas mediterráneas base (idempotente). `POST /pantry/recetas/rechazar-ingrediente` añade ingrediente a `excluir_ingredientes` del perfil individual. Lista de la compra: tabla `lista_compra` + 5 endpoints bajo `/lista-compra` + `ShoppingListScreen`.
- **Fase 5:** RevenueCat 3 tiers + flujos A/B/C completos.

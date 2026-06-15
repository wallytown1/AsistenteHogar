// eslint.config.js — Escudo de linting del frontend (Expo SDK 54, ESLint 9 flat config).
// Orden importante: la config de Expo primero, y prettier al final para desactivar
// cualquier regla de estilo que choque con el formateador (Prettier manda en formato).
const expoFlat = require('eslint-config-expo/flat');
const prettierFlat = require('eslint-config-prettier/flat');

module.exports = [
  ...expoFlat,
  prettierFlat,
  {
    ignores: ['node_modules/*', '.expo/*', 'dist/*', 'babel.config.js', 'metro.config.js'],
  },
  {
    // Hooks de datos (use{Dashboard,Pantry,Calendar,Tasks}): el patrón canónico de
    // fetch-on-mount con AbortController llama setLoading(true) de forma síncrona al
    // arrancar el efecto. La regla react-hooks/set-state-in-effect lo marca como falso
    // positivo: aquí el efecto SÍ sincroniza con un sistema externo (la API) y limpia
    // con ctrl.abort(). Desactivada solo en esta carpeta para no bloquear commits.
    files: ['src/hooks/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

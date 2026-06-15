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
];

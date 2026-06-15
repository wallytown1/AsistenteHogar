// lint-staged.config.js — Qué se ejecuta sobre los ficheros *staged* del frontend en cada commit.
//
// Usamos la forma de función (no array) a propósito: así controlamos exactamente los
// argumentos. ESLint y Prettier reciben SOLO la lista de ficheros tocados (rápido); en
// cambio `tsc` corre sobre TODO el proyecto y NO debe recibir ficheros sueltos, porque
// pasar ficheros a tsc ignora el tsconfig.json y rompe la resolución de tipos del proyecto.
module.exports = {
  '**/*.{ts,tsx}': (files) => {
    const list = files.join(' ');
    return [
      `eslint --fix ${list}`,
      `prettier --write ${list}`,
      'tsc --noEmit',
    ];
  },
};

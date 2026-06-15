"""Minimización de datos hacia el LLM (RGPD art. 5.1.c).

Sustituye los nombres propios de la familia por tokens genéricos Familiar_N antes
de que el prompt salga hacia la API de Gemini, y los revierte en la respuesta.
El diccionario de alias se construye solo desde campos estructurados
(asignado_a, participantes), nunca con NER sobre texto libre: los campos
estructurados son la fuente de verdad de qué es un nombre.

Orden crítico respecto al caché de llm.py: la clave SHA-256 se calcula sobre el
prompt YA anonimizado y el caché almacena la respuesta AÚN anonimizada; la
reversión se aplica siempre después. Así la caché nunca contiene datos personales.
"""
import re
from collections.abc import Iterable


class AnonimizadorLLM:
    def __init__(self, nombres: Iterable[str | None]):
        # Deduplicación sin distinguir mayúsculas ('Ana' y 'ana' son la misma
        # persona) y orden determinista (alfabético) para que el mismo conjunto
        # de nombres produzca siempre los mismos tokens y, por tanto, la misma
        # clave de caché.
        vistos: dict[str, str] = {}
        for n in nombres:
            if n and n.strip():
                vistos.setdefault(n.strip().casefold(), n.strip())
        unicos = sorted(vistos.values(), key=str.casefold)
        self._alias = {
            nombre: f"Familiar_{i}" for i, nombre in enumerate(unicos, start=1)
        }

    @property
    def tiene_nombres(self) -> bool:
        return bool(self._alias)

    def anonimizar(self, texto: str) -> str:
        """Reemplaza cada nombre conocido por su token Familiar_N."""
        if not self._alias or not texto:
            return texto
        # Los nombres más largos primero: evita que 'Ana' rompa 'Ana María'
        for nombre in sorted(self._alias, key=len, reverse=True):
            patron = r"\b" + re.escape(nombre) + r"\b"
            texto = re.sub(patron, self._alias[nombre], texto, flags=re.IGNORECASE)
        return texto

    def revertir(self, texto: str) -> str:
        """Restaura los nombres reales en la respuesta del LLM. Tolerante a que
        el modelo altere el separador ('Familiar_1', 'Familiar 1')."""
        if not self._alias or not texto:
            return texto
        for nombre, token in self._alias.items():
            numero = token.split("_")[1]
            patron = r"\bFamiliar[_\s]" + numero + r"\b"
            texto = re.sub(patron, nombre, texto)
        return texto

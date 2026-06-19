"""Seed del recetario maestro mediterráneo español.
Inserta 15 recetas de referencia en la tabla recetario_maestro.
Idempotente: omite recetas ya existentes por nombre.

Ejecutar: python seed_recetario.py
Acepta DATABASE_URL del entorno (o usa SQLite local por defecto).
"""
import asyncio
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./asistente_hogar.db")
os.environ.setdefault("JWT_SECRET_KEY", "seed-recetario-key")
os.environ["GEMINI_API_KEY"] = ""

from alembic import command as alembic_command
from alembic.config import Config

print("Aplicando migraciones...")
alembic_cfg = Config("alembic.ini")
alembic_command.upgrade(alembic_cfg, "head")
print("Migraciones OK\n")

from sqlalchemy import select

from app.database import async_session_maker
from app.models.models import RecetaMaestra

RECETAS: list[dict] = [
    {
        "nombre": "Paella valenciana",
        "ingredientes": [
            "arroz bomba", "pollo troceado", "conejo troceado",
            "judías verdes", "garrofó", "tomate maduro", "pimentón dulce",
            "azafrán", "aceite de oliva", "agua", "sal",
        ],
        "pasos": [
            "Calentar aceite en paellera y dorar el pollo y el conejo hasta que estén bien tostados.",
            "Añadir las judías verdes y el garrofó; sofreír 3 minutos. Incorporar el tomate rallado y el pimentón, rehogar 2 minutos.",
            "Cubrir con agua caliente (doble volumen que el arroz) y hervir 20 minutos. Añadir el azafrán.",
            "Repartir el arroz en la paellera y cocer a fuego fuerte 8 minutos, luego a fuego medio-bajo 10 minutos.",
            "Dejar reposar tapado con papel de periódico 5 minutos antes de servir.",
        ],
        "categoria": "Arroces",
        "temporada": "Primavera-Verano",
        "aprovechamiento": True,
    },
    {
        "nombre": "Gazpacho andaluz",
        "ingredientes": [
            "tomates maduros", "pepino", "pimiento verde", "ajo",
            "pan del día anterior", "aceite de oliva virgen extra",
            "vinagre de Jerez", "sal", "agua fría",
        ],
        "pasos": [
            "Remojar el pan en agua fría 10 minutos.",
            "Triturar en batidora los tomates, pepino pelado, pimiento, ajo y pan escurrido hasta obtener crema fina.",
            "Añadir el aceite en hilo sin dejar de batir; agregar el vinagre y sal al gusto.",
            "Colar por colador fino y rectificar de agua hasta conseguir la textura deseada.",
            "Refrigerar mínimo 2 horas. Servir frío con guarnición de tomate, pepino y pimiento en daditos.",
        ],
        "categoria": "Sopas y caldos",
        "temporada": "Verano",
        "aprovechamiento": True,
    },
    {
        "nombre": "Cocido madrileño",
        "ingredientes": [
            "garbanzos", "morcillo de ternera", "tocino", "chorizo",
            "morcilla", "gallina", "repollo", "zanahoria",
            "patatas", "fideos finos", "sal",
        ],
        "pasos": [
            "Dejar los garbanzos en remojo la noche anterior. Poner agua a calentar en olla a presión con la carne, tocino y gallina desde agua fría.",
            "Cuando hierva, desespumar bien; añadir los garbanzos en una malla y las zanahorias. Cocer 45 minutos en olla a presión.",
            "Añadir las patatas, el repollo, el chorizo y la morcilla; cocer 20 minutos más.",
            "Colar el caldo y cocer los fideos para la sopa (primer plato).",
            "Servir la sopa como primer plato y la ropa vieja (garbanzos, verduras y carnes) como segundo.",
        ],
        "categoria": "Legumbres",
        "temporada": "Otoño-Invierno",
        "aprovechamiento": True,
    },
    {
        "nombre": "Tortilla española",
        "ingredientes": [
            "huevos", "patatas", "cebolla", "aceite de oliva", "sal",
        ],
        "pasos": [
            "Pelar y cortar las patatas en láminas finas; picar la cebolla.",
            "Freír patatas y cebolla en abundante aceite a fuego suave 20 minutos hasta que estén tiernas pero no tostadas. Escurrir el aceite.",
            "Batir los huevos con sal; mezclar con las patatas y la cebolla; reposar 5 minutos.",
            "En sartén antiadherente con poco aceite caliente, verter la mezcla y cuajar a fuego medio-bajo 4 minutos.",
            "Dar la vuelta con un plato y cuajar el otro lado 3 minutos. Dejar reposar 2 minutos antes de servir.",
        ],
        "categoria": "Huevos",
        "temporada": "Todo el año",
        "aprovechamiento": True,
    },
    {
        "nombre": "Lentejas estofadas con chorizo",
        "ingredientes": [
            "lentejas pardinas", "chorizo", "zanahoria", "cebolla",
            "tomate maduro", "ajo", "pimentón dulce", "aceite de oliva",
            "laurel", "sal", "agua",
        ],
        "pasos": [
            "Sofreír en aceite la cebolla y la zanahoria en dados; añadir el ajo picado y el tomate rallado.",
            "Incorporar el pimentón fuera del fuego para que no se queme; remover bien.",
            "Añadir las lentejas (sin remojo previo si son pardinas), el chorizo en rodajas y el laurel.",
            "Cubrir con agua fría y cocer a fuego suave 30-35 minutos hasta que estén tiernas. Rectificar de sal.",
            "Dejar reposar tapadas 5 minutos. El caldo debe quedar espeso, no aguado.",
        ],
        "categoria": "Legumbres",
        "temporada": "Otoño-Invierno",
        "aprovechamiento": False,
    },
    {
        "nombre": "Pisto manchego",
        "ingredientes": [
            "calabacín", "pimiento rojo", "pimiento verde", "tomate maduro",
            "cebolla", "ajo", "aceite de oliva virgen extra", "sal", "azúcar",
        ],
        "pasos": [
            "Cortar todas las verduras en dados medianos por separado.",
            "Sofreír la cebolla y el ajo en aceite a fuego suave 8 minutos; añadir los pimientos y rehogar 10 minutos más.",
            "Incorporar el calabacín y cocinar 8 minutos. Agregar el tomate pelado y troceado.",
            "Cocer a fuego suave 25-30 minutos removiendo de vez en cuando hasta que evapore el agua del tomate.",
            "Rectificar sal y una pizca de azúcar para equilibrar la acidez. Servir con huevo frito o como guarnición.",
        ],
        "categoria": "Verduras",
        "temporada": "Primavera-Verano",
        "aprovechamiento": True,
    },
    {
        "nombre": "Pollo al ajillo",
        "ingredientes": [
            "pollo troceado", "ajo", "vino blanco seco", "aceite de oliva",
            "pimentón dulce", "laurel", "sal", "pimienta negra",
        ],
        "pasos": [
            "Salpimentar el pollo. Dorar en aceite caliente a fuego fuerte hasta que esté bien tostado por todos lados.",
            "Añadir los ajos enteros con piel y el laurel; rehogar 2 minutos.",
            "Incorporar el pimentón fuera del fuego; verter el vino blanco inmediatamente para evitar que se queme.",
            "Cocer a fuego medio tapado 20 minutos hasta que el pollo esté tierno y la salsa reducida.",
            "Servir con el ajo confitado y pan para mojar la salsa.",
        ],
        "categoria": "Carnes",
        "temporada": "Todo el año",
        "aprovechamiento": False,
    },
    {
        "nombre": "Fabada asturiana",
        "ingredientes": [
            "fabes asturianas", "chorizo asturiano", "morcilla asturiana",
            "tocino", "lacón", "pimentón", "azafrán", "sal",
        ],
        "pasos": [
            "Dejar las fabes en remojo la noche anterior en agua fría.",
            "Poner las fabes en olla con agua fría junto con el chorizo, morcilla, tocino y lacón desde frío.",
            "Calentar a fuego suave; cuando empiece a hervir, desespumar y bajar el fuego al mínimo.",
            "Cocer 2-3 horas a fuego muy suave ('chup-chup'), asustando tres veces con agua fría para romper el hervor.",
            "Rectificar sal al final; servir en cazuela de barro con los compangos (embutidos) en rodajas.",
        ],
        "categoria": "Legumbres",
        "temporada": "Otoño-Invierno",
        "aprovechamiento": False,
    },
    {
        "nombre": "Salmorejo cordobés",
        "ingredientes": [
            "tomates maduros de temporada", "pan de telera o similar",
            "ajo", "aceite de oliva virgen extra", "sal",
            "huevo cocido", "jamón serrano",
        ],
        "pasos": [
            "Trocear el pan y remojar en agua fría 10 minutos.",
            "Triturar en batidora de vaso los tomates troceados, el pan escurrido y el ajo hasta obtener crema muy fina.",
            "Con la batidora en marcha, añadir el aceite en hilo fino hasta emulsionar completamente.",
            "Salar al gusto y refrigerar mínimo 2 horas; debe quedar cremoso y bien frío.",
            "Servir con daditos de huevo cocido y jamón picado por encima.",
        ],
        "categoria": "Sopas y caldos",
        "temporada": "Verano",
        "aprovechamiento": True,
    },
    {
        "nombre": "Berenjenas rellenas al horno",
        "ingredientes": [
            "berenjenas", "carne picada mixta", "cebolla", "tomate triturado",
            "ajo", "aceite de oliva", "queso rallado para gratinar",
            "pimentón", "sal", "pimienta",
        ],
        "pasos": [
            "Partir las berenjenas por la mitad, hacer cortes en la pulpa y hornear a 200 °C 20 minutos. Vaciar la pulpa con cuchara.",
            "Sofreír cebolla y ajo; añadir la carne picada y dorar bien. Incorporar la pulpa picada y el tomate.",
            "Cocer el sofrito 15 minutos hasta que espese. Salpimentar y añadir el pimentón.",
            "Rellenar las mitades de berenjena con el sofrito; cubrir con queso rallado generosamente.",
            "Gratinar en horno a 200 °C 10 minutos hasta que el queso esté dorado. Servir caliente.",
        ],
        "categoria": "Verduras",
        "temporada": "Primavera-Verano",
        "aprovechamiento": True,
    },
    {
        "nombre": "Sopa de ajo castellana",
        "ingredientes": [
            "pan del día anterior", "ajo", "pimentón dulce", "aceite de oliva",
            "huevos", "caldo de pollo o agua", "sal", "chorizo (opcional)",
        ],
        "pasos": [
            "Laminar el ajo y dorar en aceite a fuego suave hasta que esté dorado, no quemado.",
            "Añadir el chorizo en rodajas (opcional) y el pimentón fuera del fuego; remover rápido.",
            "Incorporar el pan en rebanadas finas; verter el caldo caliente y hervir 10 minutos.",
            "Romper los huevos directamente en la cazuela y cuajar con el calor residual tapando 3 minutos.",
            "Servir en cazuela de barro muy caliente; el pan debe quedar semicrujiente por arriba.",
        ],
        "categoria": "Sopas y caldos",
        "temporada": "Otoño-Invierno",
        "aprovechamiento": True,
    },
    {
        "nombre": "Arroz con leche a la asturiana",
        "ingredientes": [
            "arroz de grano redondo", "leche entera", "azúcar",
            "corteza de limón", "rama de canela", "canela en polvo",
        ],
        "pasos": [
            "Hervir el arroz con un poco de agua 5 minutos; escurrir.",
            "Calentar la leche con la corteza de limón y la rama de canela sin que llegue a hervir.",
            "Añadir el arroz escurrido a la leche caliente y cocer a fuego mínimo 30-40 minutos removiendo continuamente.",
            "Cuando el arroz esté cremoso, añadir el azúcar y cocer 5 minutos más.",
            "Distribuir en cuencos y espolvorear con canela en polvo. Servir frío o templado.",
        ],
        "categoria": "Postres",
        "temporada": "Todo el año",
        "aprovechamiento": False,
    },
    {
        "nombre": "Judías verdes con patatas y tomate",
        "ingredientes": [
            "judías verdes", "patatas", "tomate maduro", "ajo",
            "aceite de oliva virgen extra", "sal", "pimentón (opcional)",
        ],
        "pasos": [
            "Limpiar las judías verdes quitando los hilos; trocear en segmentos de 5 cm. Pelar y cuartear las patatas.",
            "Sofreír el ajo laminado en aceite; añadir el tomate pelado y troceado, cocer 8 minutos.",
            "Incorporar las judías y las patatas; cubrir con agua y hervir a fuego medio 20-25 minutos.",
            "Comprobar que las judías estén tiernas pero no deshéchas; rectificar de sal.",
            "Añadir un chorrito de aceite de oliva crudo antes de servir para dar brillo.",
        ],
        "categoria": "Verduras",
        "temporada": "Todo el año",
        "aprovechamiento": True,
    },
    {
        "nombre": "Bacalao al pil-pil",
        "ingredientes": [
            "lomos de bacalao desalado", "ajo", "guindilla", "aceite de oliva virgen extra",
        ],
        "pasos": [
            "Desalar el bacalao 48 horas cambiando el agua cada 8 horas. Secar bien con papel.",
            "Confitar el ajo laminado en aceite de oliva a fuego muy bajo (60-70 °C) 10 minutos; retirar los ajos.",
            "Añadir el bacalao con la piel hacia abajo; confitar a fuego mínimo 8-10 minutos. Retirar el bacalao.",
            "Ligar la salsa: mover la cazuela en círculos para que la gelatina del bacalao emulsione con el aceite hasta obtener crema espesa.",
            "Colocar el bacalao sobre la salsa pil-pil y decorar con el ajo y la guindilla.",
        ],
        "categoria": "Pescados",
        "temporada": "Todo el año",
        "aprovechamiento": False,
    },
    {
        "nombre": "Menestra de verduras a la navarra",
        "ingredientes": [
            "alcachofas", "guisantes", "habas", "espárragos verdes",
            "judías verdes", "zanahoria", "jamón serrano", "cebolla",
            "ajo", "harina", "aceite de oliva", "caldo de verduras", "sal",
        ],
        "pasos": [
            "Cocer por separado cada verdura al dente en agua con sal. Escurrir y reservar.",
            "Sofreír cebolla y ajo en aceite; añadir el jamón picado y rehogar 2 minutos.",
            "Espolvorear una cucharada de harina y remover; verter el caldo caliente y cocer 5 minutos formando salsa ligera.",
            "Incorporar todas las verduras cocidas y saltear 3-4 minutos para que se impregnen de la salsa.",
            "Rectificar sal y servir bien caliente. La menestra no debe llevar demasiado caldo, ha de quedar trabada.",
        ],
        "categoria": "Verduras",
        "temporada": "Primavera-Verano",
        "aprovechamiento": True,
    },
]


async def seed() -> None:
    insertadas = 0
    omitidas = 0

    async with async_session_maker() as session:
        for datos in RECETAS:
            result = await session.execute(
                select(RecetaMaestra).where(RecetaMaestra.nombre == datos["nombre"])
            )
            if result.scalar_one_or_none() is not None:
                print(f"  [SKIP] {datos['nombre']}")
                omitidas += 1
                continue

            receta = RecetaMaestra(**datos)
            session.add(receta)
            await session.commit()
            print(f"  [OK  ] {datos['nombre']}")
            insertadas += 1

    print(f"\n{'='*50}")
    print(f"Resultado: {insertadas} insertadas, {omitidas} ya existían.")
    if insertadas + omitidas != len(RECETAS):
        print("AVISO: alguna receta falló — revisa el log.")
        sys.exit(1)
    else:
        print("Recetario listo.")


asyncio.run(seed())

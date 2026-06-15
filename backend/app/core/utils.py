def sanitize_text(t: str | None) -> str | None:
    """Normaliza texto libre quitando los espacios sobrantes en los extremos.

    No escapa comillas ni barras invertidas: hacerlo corrompía el texto visible
    (p. ej. 'Comprar "leche"' se almacenaba y mostraba con barras invertidas) sin
    aportar seguridad real. La protección contra inyección ya la garantizan las
    consultas parametrizadas de SQLAlchemy y la serialización JSON de FastAPI.
    """
    if t is None:
        return None
    return t.strip()

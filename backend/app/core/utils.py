from typing import Optional


def sanitize_text(t: Optional[str]) -> Optional[str]:
    """Sanitiza strings de texto libre: escapa barras invertidas y comillas dobles, quita espacios."""
    if t is None:
        return None
    return t.replace("\\", "\\\\").replace('"', '\\"').strip()

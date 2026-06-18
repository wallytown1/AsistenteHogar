class RepositoryError(Exception):
    """Base exception for all repository level errors."""

    def __init__(self, message: str = "Error en la capa de persistencia de datos"):
        self.message = message
        super().__init__(self.message)


class ItemNotFoundError(RepositoryError):
    """Raised when an inventory item does not exist or does not belong to the Hogar."""

    def __init__(self, item_id: str, hogar_id: str):
        self.item_id = item_id
        self.hogar_id = hogar_id
        super().__init__(
            f"No se ha encontrado el producto con ID {item_id} en el hogar {hogar_id}"
        )


class DatabaseIntegrityError(RepositoryError):
    """Raised when a database integrity constraint is violated (e.g., FK non-existent)."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(f"Error de integridad en base de datos: {detail}")


class ReglaNegocioError(RepositoryError):
    """Raised when a domain invariant is violated (e.g., inconsistent event dates on
    a PATCH where the schema validator cannot see the persisted value). Maps to HTTP 422
    to match the schema-level validation contract."""

    def __init__(self, message: str):
        super().__init__(message)

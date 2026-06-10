class RepositoryError(Exception):
    """Base exception for all repository level errors."""
    def __init__(self, message: str = "Error en la capa de persistencia de datos"):
        self.message = message
        super().__init__(self.message)

class HogarNotFoundError(RepositoryError):
    """Raised when a specific Hogar does not exist in the database."""
    def __init__(self, hogar_id: str):
        self.hogar_id = hogar_id
        super().__init__(f"No se ha encontrado ningún hogar registrado con el ID: {hogar_id}")

class ItemNotFoundError(RepositoryError):
    """Raised when an inventory item does not exist or does not belong to the Hogar."""
    def __init__(self, item_id: str, hogar_id: str):
        self.item_id = item_id
        self.hogar_id = hogar_id
        super().__init__(f"No se ha encontrado el producto con ID {item_id} en el hogar {hogar_id}")

class EventoNotFoundError(RepositoryError):
    """Raised when a calendar event does not exist or does not belong to the Hogar."""
    def __init__(self, evento_id: str, hogar_id: str):
        self.evento_id = evento_id
        self.hogar_id = hogar_id
        super().__init__(f"No se ha encontrado el evento con ID {evento_id} en el hogar {hogar_id}")

class TaskNotFoundError(RepositoryError):
    """Raised when a task does not exist or does not belong to the Hogar."""
    def __init__(self, task_id: str, hogar_id: str):
        self.task_id = task_id
        self.hogar_id = hogar_id
        super().__init__(f"No se ha encontrado la tarea con ID {task_id} en el hogar {hogar_id}")

class DatabaseIntegrityError(RepositoryError):
    """Raised when a database integrity constraint is violated (e.g., FK non-existent)."""
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(f"Error de integridad en base de datos: {detail}")

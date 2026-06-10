import logging


def setup_logging() -> None:
    """Configura un formato de log estructurado y consistente para toda la aplicación.

    Formato: fecha | nivel | logger | mensaje — apto para ingestión por
    sistemas de monitoreo (CloudWatch, Railway logs, etc.).
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

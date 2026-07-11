import logging
import os

# Configuração básica de logging estruturado
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=getattr(logging, LOG_LEVEL, logging.INFO)
)

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

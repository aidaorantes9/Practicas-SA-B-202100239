# pytest carga este archivo antes de cualquier test
# fijamos las variables de entorno de la base de datos aqui
# porque app/database.py crea el engine al importarse, y sin esto fallaria

import os

os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_USER", "usuario_de_prueba")
os.environ.setdefault("DB_PASSWORD", "clave_de_prueba")
os.environ.setdefault("DB_NAME", "db_de_prueba")

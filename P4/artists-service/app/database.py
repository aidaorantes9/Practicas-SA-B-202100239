# este archivo configura la conexion a postgres usando sqlalchemy
# es el equivalente al db.js que usamos en los servicios de node

import os
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# clase base que van a heredar los modelos
Base = declarative_base()


def wait_for_db():
    # reintenta la conexion varias veces por si la base de datos
    # todavia no esta lista cuando el servicio arranca
    intentos = 0
    max_intentos = 10

    while intentos < max_intentos:
        try:
            conn = engine.connect()
            conn.close()
            print("artists-service: conexion a base de datos lista")
            return
        except Exception:
            intentos += 1
            print(f"artists-service: esperando base de datos, intento {intentos}")
            time.sleep(3)

    raise Exception("artists-service: no se pudo conectar a la base de datos")


def get_db():
    # esta funcion se usa para abrir y cerrar la sesion en cada request
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# punto de entrada del microservicio de artistas
# expone graphql en /graphql y un endpoint rest simple para uso interno

from fastapi import FastAPI
from strawberry.fastapi import GraphQLRouter

from app.database import Base, engine, wait_for_db, get_db
from app.schema import schema
from app.models import Artist

app = FastAPI(title="artists-service")

graphql_router = GraphQLRouter(schema)
app.include_router(graphql_router, prefix="/graphql")


# endpoint simple para saber si el servicio esta vivo
@app.get("/health")
def health():
    return {"status": "ok", "service": "artists-service"}


# endpoint rest interno, lo usa appointments-service directamente
# sin pasar por el api gateway, para consultar si un artista esta disponible
@app.get("/internal/artists/{artist_id}/availability")
def check_availability(artist_id: int):
    db = next(get_db())
    artista = db.query(Artist).filter(Artist.id == artist_id).first()

    if artista is None:
        return {"found": False, "available": False}

    return {"found": True, "available": artista.available, "name": artista.name}


# al arrancar el servicio, esperamos la base de datos y creamos las tablas
@app.on_event("startup")
def startup():
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    print("artists-service: tabla artists lista")
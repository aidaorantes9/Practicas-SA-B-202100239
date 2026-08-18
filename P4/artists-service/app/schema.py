# aqui se define el schema de graphql
# strawberry usa clases de python normales para describir los tipos

import strawberry
from typing import List, Optional
from app.database import SessionLocal
from app.models import Artist as ArtistModel


# este es el tipo que graphql expone al cliente
@strawberry.type
class ArtistType:
    id: int
    name: str
    specialty: str
    bio: Optional[str]
    available: bool


# convierte un objeto de sqlalchemy al tipo de graphql
def to_graphql_type(artist: ArtistModel) -> ArtistType:
    return ArtistType(
        id=artist.id,
        name=artist.name,
        specialty=artist.specialty,
        bio=artist.bio,
        available=artist.available,
    )


@strawberry.type
class Query:
    # trae todos los artistas
    @strawberry.field
    def artists(self) -> List[ArtistType]:
        db = SessionLocal()
        try:
            resultados = db.query(ArtistModel).all()
            return [to_graphql_type(a) for a in resultados]
        finally:
            db.close()

    # trae un solo artista por id
    @strawberry.field
    def artist(self, id: int) -> Optional[ArtistType]:
        db = SessionLocal()
        try:
            resultado = db.query(ArtistModel).filter(ArtistModel.id == id).first()
            if resultado is None:
                return None
            return to_graphql_type(resultado)
        finally:
            db.close()


@strawberry.type
class Mutation:
    # crea un artista nuevo, normalmente lo usaria un admin
    @strawberry.mutation
    def create_artist(
        self, name: str, specialty: str, bio: Optional[str] = None
    ) -> ArtistType:
        db = SessionLocal()
        try:
            nuevo = ArtistModel(name=name, specialty=specialty, bio=bio, available=True)
            db.add(nuevo)
            db.commit()
            db.refresh(nuevo)
            return to_graphql_type(nuevo)
        finally:
            db.close()

    # cambia si un artista esta disponible o no para citas nuevas
    @strawberry.mutation
    def set_availability(self, id: int, available: bool) -> Optional[ArtistType]:
        db = SessionLocal()
        try:
            artista = db.query(ArtistModel).filter(ArtistModel.id == id).first()
            if artista is None:
                return None
            artista.available = available
            db.commit()
            db.refresh(artista)
            return to_graphql_type(artista)
        finally:
            db.close()


schema = strawberry.Schema(query=Query, mutation=Mutation)
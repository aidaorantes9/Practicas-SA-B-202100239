# pruebas de la conversion de modelo sqlalchemy a tipo graphql
# el modelo se instancia en memoria, sin necesitar conexion real a la base de datos

from app.models import Artist
from app.schema import to_graphql_type


def test_to_graphql_type_convierte_todos_los_campos():
    artista = Artist(
        id=1,
        name="Juan Perez",
        specialty="realismo",
        bio="tatuador con 10 anios de experiencia",
        available=True,
    )

    resultado = to_graphql_type(artista)

    assert resultado.id == 1
    assert resultado.name == "Juan Perez"
    assert resultado.specialty == "realismo"
    assert resultado.bio == "tatuador con 10 anios de experiencia"
    assert resultado.available is True


def test_to_graphql_type_permite_bio_nula():
    artista = Artist(
        id=2,
        name="Maria Lopez",
        specialty="blackwork",
        bio=None,
        available=False,
    )

    resultado = to_graphql_type(artista)

    assert resultado.bio is None
    assert resultado.available is False

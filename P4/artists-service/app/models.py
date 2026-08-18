# modelo de la tabla artists
# guarda el catalogo de tatuadores del estudio

from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    specialty = Column(String(100), nullable=False)  # ejemplo: realismo, blackwork
    bio = Column(String(500), nullable=True)
    available = Column(Boolean, default=True)  # si esta tomando citas nuevas
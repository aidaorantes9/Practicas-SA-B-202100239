FROM python:3.12-slim

# actualizo los paquetes del sistema para corregir vulnerabilidades conocidas
# de la imagen base (ej. perl-base, perl-archive-tar)
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd -u 1000 -m appuser && chown -R appuser:appuser /app

USER appuser

EXPOSE 4001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4001"]

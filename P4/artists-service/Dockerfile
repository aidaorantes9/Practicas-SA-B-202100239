# imagen base de python, version liviana
FROM python:3.12-slim

WORKDIR /app

# copiamos primero requirements para aprovechar el cache de docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# copiamos el resto del codigo
COPY app ./app

EXPOSE 4001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4001"]
# imagen base de node, version liviana
FROM node:20-alpine

# carpeta de trabajo dentro del contenedor
WORKDIR /app

# copio  primero el package json para aprovechar el cache de docker
COPY package.json .
RUN npm install

# copio el resto del codigo
COPY src ./src

# puerto en el que corre este servicio
EXPOSE 4000

# comando que arranca el servicio
CMD ["npm", "start"]
FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY src ./src

# le damos la propiedad de los archivos al usuario node
# esto es necesario porque el contenedor corre con runAsNonRoot en kubernetes
RUN chown -R node:node /app

USER node

# no hay cmd por defecto fijo, cada cronjob de kubernetes especifica
# cual script correr (insert-execution.js o summarize-and-publish.js)
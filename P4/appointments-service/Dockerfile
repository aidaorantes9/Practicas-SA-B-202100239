FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY src ./src

# le damos la propiedad de los archivos al usuario node (uid 1000)
# esto es necesario porque el contenedor corre con runAsNonRoot en kubernetes
RUN chown -R node:node /app

USER node

EXPOSE 4002

CMD ["npm", "start"]
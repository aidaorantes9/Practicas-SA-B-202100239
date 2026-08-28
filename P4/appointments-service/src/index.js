// punto de entrada del microservicio de citas
// expone graphql en /graphql

const express = require("express");
const { graphqlHTTP } = require("express-graphql");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const { initDb } = require("./db");
const { connectRabbitMQ } = require("./rabbitmq");
const schema = require("./schema/typeDefs");
const rootValue = require("./resolvers/resolvers");

const app = express();
const PORT = process.env.PORT || 4002;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "appointments-service" });
});

// graphiql en true nos deja probar el graphql desde el navegador
app.use(
  "/graphql",
  graphqlHTTP((request) => ({
    schema,
    rootValue,
    graphiql: true,
    context: { request },
  }))
);

Promise.all([initDb(), connectRabbitMQ()])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`appointments-service corriendo en el puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("appointments-service no pudo iniciar:", error);
    process.exit(1);
  });
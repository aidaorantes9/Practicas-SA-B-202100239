// este es el punto de entrada de todo el proyecto
// aca se "arma" toda la cadena de dependencias antes de levantar el servidor

require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const PostgresSolicitudRepository = require('./src/repositories/PostgresSolicitudRepository');
const SolicitudService = require('./src/services/SolicitudService');
const SolicitudController = require('./src/controllers/SolicitudController');
const crearSolicitudRoutes = require('./src/routes/solicitudRoutes');
const errorHandler = require('./src/middlewares/errorHandler');

// conexion a supabase, uso la url completa que esta en el .env
// el ssl es obligatorio porque supabase lo exige para conexiones externas
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// aca se inyecta todo de abajo hacia arriba:
// pool -> repository (implementa la interfaz) -> service (reglas de negocio)
// -> controller (traduce http) -> routes (conecta las urls)
const solicitudRepository = new PostgresSolicitudRepository(pool);
const solicitudService = new SolicitudService(solicitudRepository);
const solicitudController = new SolicitudController(solicitudService);
const solicitudRoutes = crearSolicitudRoutes(solicitudController);

const app = express();
app.use(express.json()); // para poder leer json en el body de los requests
app.use('/', solicitudRoutes);
app.use(errorHandler); // este siempre va al final, despues de las rutas

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`servidor escuchando en el puerto ${PUERTO}`));

module.exports = app;
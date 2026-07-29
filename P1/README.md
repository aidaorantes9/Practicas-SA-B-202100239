# Práctica 1 - Software Avanzado
## API REST para gestión de solicitudes operativas

Sistema backend construido con **Node.js**, **Express** y **PostgreSQL (Supabase)** para gestionar las solicitudes operativas de una academia ficticia, aplicando los 5 principios SOLID y buenas prácticas de código limpio y seguridad.

## Índice

- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación y configuración](#instalación-y-configuración)
- [Endpoints disponibles](#endpoints-disponibles)
- [Principios SOLID aplicados](#principios-solid-aplicados)
- [Seguridad implementada](#seguridad-implementada)
- [Uso de Inteligencia Artificial](#uso-de-inteligencia-artificial)
- [Capturas de prueba](#capturas-de-prueba)

## Tecnologías utilizadas

- **Node.js** + **Express** — servidor y framework HTTP
- **PostgreSQL** en la nube, alojado en **Supabase**
- **pg** — driver nativo para conectar Node.js con PostgreSQL
- **dotenv** — manejo de variables de entorno
- **Postman** — pruebas manuales de los endpoints
- Apoyo de **[nombre de la IA que usaste, ej. ChatGPT/Claude]** para la generación inicial de código, con revisión y corrección manual (ver `PROMPTS.md`)

## Estructura del proyecto

```
P1/
├── app.js                          # punto de entrada, arma la inyección de dependencias
├── .env                            # variables de entorno (no se sube al repo)
├── .gitignore
├── package.json
└── src/
    ├── interfaces/
    │   └── ISolicitudRepository.js # contrato/abstracción del repositorio
    ├── repositories/
    │   └── PostgresSolicitudRepository.js  # acceso a datos (SQL)
    ├── services/
    │   ├── SolicitudService.js     # reglas de negocio y validaciones
    │   └── ValidationError.js      # error personalizado de dominio
    ├── controllers/
    │   └── SolicitudController.js  # traduce HTTP <-> Service
    ├── routes/
    │   └── solicitudRoutes.js      # definición de endpoints
    └── middlewares/
        ├── asyncHandler.js         # captura errores async automáticamente
        └── errorHandler.js         # maneja errores de forma centralizada
```

## Instalación y configuración

1. Clonar el repositorio y entrar a la carpeta `P1`:
```bash
cd P1
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear un archivo `.env` en la raíz de `P1` con el siguiente contenido (usando tu propia cadena de conexión de Supabase):
```
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/postgres
PORT=3000
```

4. Crear la tabla en la base de datos (ejecutar en el SQL Editor de Supabase):
```sql
CREATE TABLE solicitudes (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  area_solicitante VARCHAR(100) NOT NULL,
  prioridad INTEGER NOT NULL CHECK (prioridad BETWEEN 1 AND 5),
  costo_estimado NUMERIC(10,2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'registrada'
    CHECK (estado IN ('registrada','en_proceso','finalizada'))
);
```

5. Levantar el servidor:
```bash
node app.js
```

Debería mostrar:
```
servidor escuchando en el puerto 3000
```

## Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/solicitudes` | Obtiene todas las solicitudes |
| POST | `/solicitudes` | Crea una nueva solicitud |
| PUT | `/solicitudes/:id` | Actualiza completamente una solicitud existente |
| PATCH | `/solicitudes/:id/estado` | Actualiza únicamente el estado de una solicitud |
| DELETE | `/solicitudes/:id` | Elimina una solicitud |

### Ejemplo de body para POST y PUT

```json
{
  "titulo": "Adquisición de nuevo servidor",
  "area_solicitante": "Infraestructura TI",
  "prioridad": 3,
  "costo_estimado": 2500.00,
  "estado": "registrada"
}
```

### Ejemplo de body para PATCH

```json
{
  "estado": "finalizada"
}
```

## Principios SOLID aplicados

### S — Principio de Responsabilidad Única (SRP)

Cada clase del proyecto tiene una sola razón para cambiar. Por ejemplo, `SolicitudController` solo se encarga de traducir peticiones HTTP a llamadas del service, sin conocer reglas de negocio ni SQL:

```js
// src/controllers/SolicitudController.js
crearSolicitud = async (req, res) => {
  const solicitudCreada = await this.solicitudService.crearSolicitud(req.body);
  res.status(201).json(solicitudCreada);
};
```

Mientras que toda la validación de negocio vive únicamente en `SolicitudService`:

```js
// src/services/SolicitudService.js
_validarPrioridad(prioridad) {
  const esEntero = Number.isInteger(prioridad);
  if (!esEntero || prioridad < 1 || prioridad > 5) {
    throw new ValidationError(
      `el campo prioridad debe ser un numero entero entre 1 y 5, se recibio: ${JSON.stringify(prioridad)}`,
      'prioridad'
    );
  }
}
```

Si el controller tuviera esta validación, o si el service manejara `req`/`res`, se rompería este principio. Al separarlo así, cada archivo cambia solo por una razón: el controller cambia si cambia el "transporte" (por ejemplo si pasáramos de HTTP a otro protocolo), y el service cambia solo si cambian las reglas de negocio.

### O — Principio Abierto/Cerrado (OCP)

El sistema está **abierto a extensión** pero **cerrado a modificación**: se puede agregar una nueva forma de guardar los datos sin tocar el código existente, gracias a que todo depende de la interfaz `ISolicitudRepository`:

```js
// src/interfaces/ISolicitudRepository.js
class ISolicitudRepository {
  async findAll() {
    throw new Error('metodo findAll no implementado');
  }
  // ...
}
```

Si en el futuro se quisiera usar MongoDB en vez de PostgreSQL, bastaría con crear una clase `MongoSolicitudRepository` que implemente los mismos 5 métodos, sin modificar ni una línea de `SolicitudService`, `SolicitudController` ni las rutas.

### L — Principio de Sustitución de Liskov (LSP)

Cualquier clase que implemente `ISolicitudRepository` puede sustituir a `PostgresSolicitudRepository` sin romper el comportamiento del resto de la aplicación, porque todas cumplen el mismo contrato (mismos métodos, mismas firmas, mismo tipo de retorno):

```js
// src/repositories/PostgresSolicitudRepository.js
class PostgresSolicitudRepository extends ISolicitudRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }
  // implementa findAll, create, update, delete, updateEstado
  // devolviendo siempre los mismos tipos de datos que espera ISolicitudRepository
}
```

Como `SolicitudService` solo conoce la abstracción (recibe el repositorio inyectado por constructor), cualquier implementación válida puede "sustituir" a la actual sin que el service note la diferencia:

```js
// src/services/SolicitudService.js
constructor(solicitudRepository) {
  this.solicitudRepository = solicitudRepository;
}
```

### I — Principio de Segregación de Interfaces (ISP)

`ISolicitudRepository` solo expone los 5 métodos que realmente necesita el dominio de solicitudes (`findAll`, `create`, `update`, `delete`, `updateEstado`) — no se agregó ningún método extra que alguna clase implementadora estuviera obligada a definir sin usarlo. Esto evita que una futura implementación (por ejemplo, un repositorio de solo lectura para reportes) tenga que implementar métodos de escritura que no necesita.

### D — Principio de Inversión de Dependencias (DIP)

Las clases de alto nivel (`SolicitudService`, `SolicitudController`) no dependen de una implementación concreta de base de datos, sino de la abstracción `ISolicitudRepository`. La implementación concreta (`PostgresSolicitudRepository`) también depende de esa misma abstracción, no al revés:

```js
// app.js
const solicitudRepository = new PostgresSolicitudRepository(pool);
const solicitudService = new SolicitudService(solicitudRepository);
const solicitudController = new SolicitudController(solicitudService);
```

El `pool` de conexión se crea en `app.js` y se **inyecta** hacia abajo en cada capa, en vez de que cada clase cree sus propias dependencias internamente. Esto es lo que permite, por ejemplo, reemplazar `PostgresSolicitudRepository` por una versión en memoria para pruebas unitarias, sin tocar `SolicitudService` ni `SolicitudController`.

## Seguridad implementada

- **Prevención de inyección SQL:** todas las queries usan parámetros (`$1`, `$2`, etc.) del driver `pg`, nunca concatenación de strings con datos del usuario.
- **Validación de entradas:** `SolicitudService` valida tipo, rango y presencia de cada campo antes de tocar la base de datos (prioridad 1-5, costo positivo, estado dentro de los 3 valores permitidos, título y área no vacíos).
- **Manejo de errores sin fuga de información:** el middleware `errorHandler` nunca envía el stack trace ni detalles internos al cliente; los errores de infraestructura responden con un mensaje genérico (500) y solo se loggean en el servidor.
- **Credenciales fuera del código fuente:** la cadena de conexión a la base de datos vive en `.env`, el cual está excluido del repositorio mediante `.gitignore`.

## Uso de Inteligencia Artificial

Para este proyecto usé [nombre de la IA que usaste, ej. ChatGPT/Claude] como apoyo para generar el código base de cada capa (repositorio, servicio, controlador y rutas), pidiendo explícitamente código seguro y limpio en cada prompt. Después revisé cada archivo generado, encontré varios problemas reales y los corregí antes de integrarlos al proyecto. A continuación documento los prompts usados y los ajustes que hice.

### Prompt 1: Capa de repositorio (DIP/OCP)

**Prompt usado:**
```
Actúa como un ingeniero backend senior. Necesito el código en Node.js con Express y el driver "pg" para PostgreSQL, para gestionar una tabla "solicitudes" con columnas: id, titulo, area_solicitante, prioridad (1-5), costo_estimado, estado (registrada/en_proceso/finalizada).

Genera:
1. Una interfaz/abstracción "ISolicitudRepository" con los métodos: findAll, create, update, delete, updateEstado.
2. Una clase "PostgresSolicitudRepository" que implemente esa interfaz.

Requisitos obligatorios de seguridad:
- TODAS las queries SQL deben usar parámetros ($1, $2, etc.), nunca concatenación de strings, para prevenir inyección SQL.
- Maneja errores de base de datos con try/catch y relanza errores descriptivos.

Requisitos de código limpio:
- Nombres de variables y funciones descriptivos.
- Cada método debe tener una única responsabilidad.
- Sin código duplicado entre métodos.

Explica brevemente al final cómo esta estructura aplica el principio de Inversión de Dependencias (DIP) y Abierto/Cerrado (OCP).
```

**Respuesta obtenida (resumen):** la IA generó `ISolicitudRepository` como clase base con métodos que lanzan error si no se implementan (patrón para simular interfaces en JS), y `PostgresSolicitudRepository` con el pool de `pg` inyectado por constructor, un método privado `_ejecutarQuery` para centralizar el try/catch, y todas las queries parametrizadas.

**Ajustes que hice:** en el método `update()`, la IA usó `COALESCE($1, titulo)` en cada columna, lo que convertía la actualización en parcial (como un PATCH). Pero el enunciado pide que PUT sea una actualización **completa**, distinta del PATCH que ya existe para el estado. Cambié el `UPDATE` para que reemplace todos los campos directamente (`SET titulo = $1, ...`), sin `COALESCE`, y ahora exige que todos los campos vengan presentes.

**Evidencia de la conversación:**
![Prompt 1 - repositorio](/P1/capturas/prompt-1-repositorio.png)

### Prompt 2: Capa de servicio (SRP)

**Prompt usado:**
```
Actúa como ingeniero backend senior aplicando Clean Code. Con base en una interfaz "ISolicitudRepository" (métodos: findAll, create, update, delete, updateEstado), genera una clase "SolicitudService" en Node.js que:

1. Reciba el repositorio inyectado por constructor (no lo instancie internamente).
2. Contenga la lógica de validación de negocio:
   - "prioridad" debe ser un entero entre 1 y 5.
   - "costo_estimado" debe ser un número positivo.
   - "estado" solo puede ser "registrada", "en_proceso" o "finalizada".
   - "titulo" y "area_solicitante" no pueden estar vacíos.
3. Lance errores personalizados y descriptivos cuando la validación falle (ej. clase ValidationError), sin usar mensajes genéricos.

Requisitos de seguridad: no confíes en los datos de entrada, valida todo antes de pasarlo al repositorio.
Requisitos de código limpio: el service NO debe contener SQL ni lógica HTTP, solo reglas de negocio (principio de responsabilidad única).

Explica al final por qué esta clase cumple el Principio de Responsabilidad Única (SRP).
```

**Respuesta obtenida (resumen):** la IA generó `SolicitudService` con una validación privada por campo (`_validarTitulo`, `_validarPrioridad`, etc.), una clase `ValidationError` separada, y dos métodos combinados: `_validarDatosCreacion` (para POST) y `_validarDatosActualizacion` (para PUT).

**Ajustes que hice:** `_validarDatosActualizacion` solo validaba los campos que llegaran presentes (`if (titulo !== undefined) ...`), es decir, trataba la actualización como parcial. Esto ya no era consistente con la corrección que hice en el repositorio (donde el `update()` ahora exige todos los campos). Cambié el método para que valide **todos** los campos obligatorios siempre, igual que en la creación, manteniendo el PUT como una actualización completa de principio a fin.

**Evidencia de la conversación:**
![Prompt 2 - servicio](/P1/capturas/prompt-2-servicio.png)

### Prompt 3: Capa de controlador y rutas (REST)

**Prompt usado:**
```
Actúa como ingeniero backend senior. Con base en una clase "SolicitudService" (métodos: listarSolicitudes, crearSolicitud, actualizarSolicitud, eliminarSolicitud, cambiarEstadoSolicitud), genera en Node.js con Express:

1. Un "SolicitudController" con métodos que manejen req/res para estos 5 endpoints REST:
   - GET /solicitudes
   - POST /solicitudes
   - PUT /solicitudes/:id
   - DELETE /solicitudes/:id
   - PATCH /solicitudes/:id/estado
2. Un archivo de rutas (solicitudRoutes.js) que conecte cada endpoint con su método del controller.

Requisitos de seguridad:
- Valida que ":id" sea numérico antes de usarlo.
- Devuelve códigos HTTP correctos: 200, 201, 400 (datos inválidos), 404 (no encontrado), 500 (error del servidor).
- Si el error es una instancia de ValidationError, responde 400 con el mensaje y el campo. Si no, responde 500 sin exponer detalles internos del error (stack trace) al cliente.

Requisitos de código limpio:
- El controller NO debe contener lógica de negocio ni SQL, solo debe traducir HTTP <-> llamadas al service (responsabilidad única).
- Usa manejo de errores centralizado (try/catch o middleware de errores).

Explica al final cómo esta separación entre controller y service aplica el principio de Responsabilidad Única (SRP) y facilita el Principio de Sustitución de Liskov (LSP) si cambiara la implementación del repositorio.
```

**Respuesta obtenida (resumen):** la IA generó `SolicitudController` con arrow functions como propiedades de clase (para no perder el contexto de `this`), validación del `id` de la URL, y un archivo de rutas que recibe el controller ya construido. También propuso usar `asyncHandler` y un middleware de errores centralizado, pero no incluyó esos dos archivos en la primera respuesta.

**Ajustes que hice:** tuve que pedirle explícitamente que generara `asyncHandler.js` y `errorHandler.js`, que faltaban para que el proyecto compilara. Además, todos los `require()` que generó asumían que los archivos estarían en la misma carpeta; tuve que corregir las rutas de importación para que coincidieran con mi estructura real de carpetas (`../interfaces/`, `../services/`, `../middlewares/`, etc.).

**Evidencia de la conversación:**
![Prompt 3 - controlador y rutas](/P1/capturas/prompt-3-controlador-rutas.png)

### Prompt 4: Corrección de conexión a base de datos (fuera del set original)

Este ajuste no vino de un prompt específico, sino de la revisión manual: el código que generó la IA en `app.js` usaba variables sueltas (`DB_HOST`, `DB_USER`, `DB_PASSWORD`...) en vez de una sola cadena de conexión, y no incluía la configuración SSL que Supabase exige para conexiones externas.

**Ajuste que hice:**
```js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
```
También agregué `require('dotenv').config();` al inicio de `app.js`, que la IA no había incluido, para que las variables del `.env` se cargaran correctamente.

Adicionalmente, la conexión directa de Supabase (`db.xxxx.supabase.co:5432`) no resolvía en mi red (error `ENOTFOUND`), así que cambié a la cadena de "Transaction pooler" que ofrece Supabase (`...pooler.supabase.com:6543`), que sí funcionó.

**Evidencia de la conversación:**
![Prompt 4 - corrección de conexión](/P1/capturas/prompt-4-conexion-bd.png)

## Capturas de prueba

Pruebas realizadas con Postman contra la base de datos real en Supabase.

### POST - Crear solicitud (201)
![Crear solicitud](/P1/capturas/01-post-crear-solicitud.png)

### GET - Listar todas las solicitudes (200)
![Listar solicitudes](/P1/capturas/02-get-listar-solicitudes.png)

### PUT - Actualización completa (200)
![Actualizar completa](/P1/capturas/03-put-actualizar-completa.png)

### PATCH - Cambiar únicamente el estado (200)
![Cambiar estado](/P1/capturas/04-patch-cambiar-estado.png)

### DELETE - Eliminar solicitud (200)
![Eliminar solicitud](/P1/capturas/05-delete-eliminar.png)

### Validación - Prioridad fuera de rango (400)
![Error prioridad inválida](/P1/capturas/06-error-prioridad-invalida.png)

### Validación - Título vacío (400)
![Error título vacío](/P1/capturas/07-error-titulo-vacio.png)

### Validación - Solicitud inexistente (404)
![Error id no encontrado](/P1/capturas/08-error-id-no-encontrado.png)
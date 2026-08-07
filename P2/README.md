# Práctica 2: Autenticación y Autorización
**Software Avanzado. USAC, Segundo Semestre 2026**     
**Aída Alejandra Mansilla Orantes. 202100239**


Módulo completo de autenticación y autorización por roles (Admin/Cliente), implementado como 3 servicios independientes: un backend de autenticación (`auth-service`), un microservicio de autorización (`authz-service`), y un frontend en React (`frontend`).

## Arquitectura

```
P2/
├── auth-service/    → Backend principal: registro, login, JWT, renovación automática
├── authz-service/   → Microservicio independiente: valida permisos por rol
└── frontend/        → React + Vite: registro, login, página de confirmación
```

`auth-service` y `authz-service` están desacoplados a propósito: el primero resuelve *quién eres*, el segundo resuelve *qué puedes hacer*. Se comunican por HTTP, y `auth-service` implementa un mecanismo de reintentos con backoff al consultar a `authz-service`.

## Requisitos previos

- Node.js 18 o superior
- MySQL (local, con MySQL Workbench u otra herramienta)
- npm

## Instrucciones de ejecución

Hay que levantar los 3 servicios, en este orden, cada uno en su propia terminal.

### 1. Base de datos

En MySQL, crea la base de datos vacía:
```sql
CREATE DATABASE practica2_auth;
```

### 2. authz-service (microservicio de autorización)

```bash
cd P2/authz-service
npm install
cp .env.example .env
npm run dev
```
Debe quedar escuchando en `http://localhost:4001`.

### 3. auth-service (backend principal)

```bash
cd P2/auth-service
npm install
cp .env.example .env
```
Edita el `.env` recién creado:
- `DB_PASSWORD`: tu contraseña real de MySQL.
- `JWT_SECRET` y `AES_SECRET_KEY`: genera valores aleatorios con:
```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
  (corre el comando dos veces, uno para cada variable ,  nunca dejes los valores de ejemplo del `.env.example`).

```bash
npm run dev
```
Debe conectar a MySQL, sincronizar el modelo (crea la tabla `users` automáticamente), y quedar escuchando en `http://localhost:4000`.

### 4. frontend

```bash
cd P2/frontend
npm install
npm run dev
```
Abre `http://localhost:5173`.

## Variables de entorno relevantes

| Variable | Servicio | Qué controla |
|---|---|---|
| `JWT_EXPIRES_IN_SECONDS` | auth-service | Tiempo de vida del JWT |
| `JWT_RENEW_GRACE_PERIOD_SECONDS` | auth-service | Ventana tras la expiración en la que el token aún puede renovarse automáticamente |
| `AES_SECRET_KEY` | auth-service | Llave usada para encriptar nombre/correo en la base de datos |
| `AUTHZ_SERVICE_URL` | auth-service | URL del microservicio de autorización |
| `AUTHZ_MAX_RETRIES` / `AUTHZ_RETRY_BACKOFF_MS` | auth-service | Número de reintentos y espera entre ellos al consultar `authz-service` |

Para efectos de la demostración en la calificación oral, `JWT_EXPIRES_IN_SECONDS` y `JWT_RENEW_GRACE_PERIOD_SECONDS` se dejaron en valores bajos (10s / 15s) en vez de los valores típicos de producción (ej. 900s / 300s), para poder mostrar la renovación automática del token sin hacer esperar al auxiliar minutos completos.

## Tecnologías utilizadas

| Tecnología | Para qué se usó | Ventajas | Desventajas |
|---|---|---|---|
| **JWT (jsonwebtoken)** | Autenticación sin estado del lado del servidor | El servidor no necesita guardar sesiones en memoria/BD; escala bien horizontalmente | Un token robado es válido hasta que expira; revocarlo antes de tiempo es más difícil que con sesiones tradicionales |
| **Cookies HTTP-only** | Almacenar el JWT en el navegador | Inaccesibles desde JavaScript del cliente, lo que mitiga robo de token por ataques XSS | Requieren configurar bien CORS (`credentials: true`) y `SameSite`; más fricción al probar con herramientas como Postman |
| **AES-256-CBC** | Encriptar nombre y correo en la base de datos | Reversible: se puede recuperar el dato original cuando el usuario lo necesita ver | Requiere manejar la llave de forma segura; si se pierde la llave, los datos encriptados son irrecuperables |
| **bcrypt** | Hashear contraseñas | Es un hash de una sola vía (no reversible), diseñado para ser lento a propósito y así dificultar ataques de fuerza bruta | No sirve para datos que se necesiten recuperar en texto plano (por eso no se usó para nombre/correo) |
| **Sequelize + MySQL** | ORM y base de datos relacional | Migra bien con modelos tipados, `sync()` crea las tablas automáticamente en desarrollo | En producción no se recomienda `sync()` (se prefieren migraciones controladas) |
| **React + Vite** | Frontend | Recarga en caliente muy rápida durante desarrollo, configuración mínima | Menos "opinionado" que otros frameworks (hay que decidir más cosas manualmente, como el manejo de rutas) |

## Decisiones de diseño destacadas

- **`emailHash` (HMAC-SHA256) separado de `emailEncrypted` (AES)**: como AES con IV aleatorio genera un resultado distinto cada vez, no se puede usar directamente para buscar "¿existe un usuario con este correo?" en el login. Se guarda un hash determinístico adicional solo para esa búsqueda, sin comprometer que el correo siga encriptado de forma reversible para cuando se necesite mostrar.
- **Contraseñas con bcrypt, no con AES**: aunque el enunciado agrupa "contraseñas" junto con nombres/correos como "información sensible a encriptar", una contraseña nunca debería ser reversible ni para el propio desarrollador ,  por eso se usó hash (bcrypt) en vez de encriptación simétrica (AES) para ese campo específico.
- **La cookie vive más tiempo que el JWT**: el `maxAge` de la cookie cubre `JWT_EXPIRES_IN_SECONDS + JWT_RENEW_GRACE_PERIOD_SECONDS`, no solo el tiempo de vida del JWT. Si la cookie expirara al mismo tiempo que el token, el navegador la borraría justo cuando el token vence, y el mecanismo de renovación nunca tendría oportunidad de ejecutarse (el servidor jamás recibiría el token vencido para poder renovarlo).
- **`exposedHeaders` en CORS**: el header `X-Token-Renewed` (usado para avisar al frontend que hubo una renovación automática) no era visible por defecto en el navegador debido a las restricciones de CORS en peticiones cross-origin, aunque el servidor sí lo enviaba (confirmado con Postman). Fue necesario agregarlo explícitamente a `exposedHeaders` en la configuración de CORS del backend.

## Diagrama de secuencia ,  Login con renovación automática y autorización por rol

```mermaid
sequenceDiagram
    actor Usuario
    participant FE as Frontend (React)
    participant AUTH as auth-service
    participant DB as MySQL
    participant AUTHZ as authz-service

    Usuario->>FE: Ingresa correo y contraseña
    FE->>AUTH: POST /api/auth/login
    AUTH->>DB: Busca usuario por emailHash
    DB-->>AUTH: Usuario encontrado (passwordHash)
    AUTH->>AUTH: bcrypt.compare(password, passwordHash)
    AUTH->>AUTH: jwt.sign() genera el token
    AUTH-->>FE: 200 OK + Set-Cookie (access_token, HttpOnly)
    FE-->>Usuario: Redirige a /confirmation

    Note over FE,AUTH: --- El JWT expira, pero la cookie sigue viva ---

    FE->>AUTH: GET /api/route1 (con cookie expirada)
    AUTH->>AUTH: jwt.verify() lanza TokenExpiredError
    AUTH->>AUTH: Verifica si sigue dentro del periodo de gracia

    alt Dentro del periodo de gracia
        AUTH->>AUTH: Genera un nuevo JWT
        AUTH->>AUTHZ: POST /authorize {role, resource: "route1"}
        AUTHZ-->>AUTH: {authorized: true/false}
        AUTH-->>FE: 200 OK + Set-Cookie (nuevo token) + X-Token-Renewed: true
        FE-->>Usuario: Muestra aviso "sesión renovada" + resultado
    else Fuera del periodo de gracia
        AUTH-->>FE: 401 Unauthorized + clearCookie
        FE-->>Usuario: Redirige a /login
    end
```

## Principios SOLID aplicados

### Single Responsibility (S)
**Evidencia:** `auth-service/src/services/jwt.service.ts` (solo firma/verifica JWT), `auth-service/src/utils/encryption.ts` (solo encripta/desencripta), `authz-service/src/services/permission.service.ts` (solo conoce la matriz de permisos).

`jwt.service.ts` solo sabe firmar y verificar tokens, no sabe qué es un usuario ni cómo se guarda en la base de datos. `encryption.ts` solo encripta, desencripta y hashea texto, sin importarle si ese texto es un nombre o un correo. Cada archivo tiene un único motivo para cambiar: si mañana cambio de librería de JWT, solo toco `jwt.service.ts`; si cambio el algoritmo de encriptación, solo toco `encryption.ts`. Si hubiera metido la lógica de JWT dentro de `user.service.ts`, ese archivo tendría dos razones distintas para cambiar, y eso ya rompería el principio.

### Open/Closed (O)
**Evidencia:** `authz-service/src/services/permission.service.ts` ,  la matriz `PERMISSIONS` se puede extender con nuevos roles/recursos sin tocar el controlador ni las rutas.

Si mañana quiero agregar un rol "supervisor", solo agrego una línea nueva al objeto `PERMISSIONS`; no toco el controlador, ni las rutas, ni el middleware. Lo mismo pasa con los errores personalizados (`EmailAlreadyExistsError`, `InvalidCredentialsError`): agregar un tercer tipo de error es agregar una clase nueva, no reescribir el `try/catch` que ya funcionaba. Si en vez de la matriz hubiera usado una cadena de `if/else` (`if (role === 'admin') ...`), agregar un rol nuevo implicaría editar una función que ya estaba funcionando, con el riesgo de romper algo que ya andaba bien.

### Liskov Substitution (L)
**Evidencia:** `auth-service/src/models/User.ts` ,  la clase `User` extiende `Model` de Sequelize y se comporta como cualquier modelo Sequelize esperado (`findByPk`, `create`, etc.), sin alterar ese contrato.

`User` extiende `Model` de Sequelize, y todo el ecosistema de Sequelize (`findByPk`, `create`, `findOne`) espera que cualquier cosa que extienda `Model` se comporte de forma predecible. Como no sobrescribí ni "hackeé" ese comportamiento, mi clase se puede usar en cualquier lugar donde se espera un `Model` sin sorpresas. Este es el principio más difícil de mostrar de forma activa: mi mérito acá es no haber violado el contrato (por ejemplo, que `.save()` a veces no guarde nada silenciosamente), más que haber construido algo explícito para cumplirlo.

### Interface Segregation (I)
**Evidencia:** `auth-service/src/services/user.service.ts` ,  las interfaces `RegisterInput`, `LoginInput` y `SafeUser` están separadas; cada función recibe solo los campos que necesita.

En vez de una sola interfaz `User` gigante con todos los campos posibles, hay varias interfaces pequeñas: `RegisterInput` con lo que se necesita para registrar, `LoginInput` con solo correo y contraseña, y `SafeUser` con lo que es seguro devolver al cliente. Así, `login()` solo pide `email` y `password`, sin obligarme a pasarle un `name` o `role` que no tienen sentido en ese momento. Si hubiera usado una sola interfaz gigante en todos lados, `login()` terminaría recibiendo campos como `passwordHash` o `id` que no le sirven de nada, y eso ensucia la función.

### Dependency Inversion (D)
**Evidencia:** `auth-service/src/controllers/auth.controller.ts` depende de `UserService` y `JwtService` (clases inyectadas), no reimplementa esa lógica dentro del controlador. Lo mismo en `authz-service/src/controllers/authorization.controller.ts` con `PermissionService`.

`auth.controller.ts` no sabe cómo se compara una contraseña con bcrypt ni cómo se firma un JWT por dentro; todo eso vive detrás de `UserService` y `JwtService`, que el controlador solo usa. Pasa lo mismo en `authz-service`: el controlador depende de `PermissionService`, no reimplementa la lógica de permisos ahí mismo. Gracias a esto, si mañana cambio de MySQL a PostgreSQL, o de bcrypt a otra librería, `auth.controller.ts` no cambia ni una línea, porque nunca dependió de esos detalles directamente ,  solo de las clases que los abstraen.
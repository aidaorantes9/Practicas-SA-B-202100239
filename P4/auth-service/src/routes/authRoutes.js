// aqui van los endpoints de autenticacion
// register, login, logout y me (perfil del usuario logueado)

const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();

const User = require("../models/User");
const { generateToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/authMiddleware");

const COOKIE_MAX_AGE_MS = parseInt(process.env.JWT_EXPIRES_IN_SECONDS, 10) * 1000;

// registrar un usuario nuevo
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "faltan campos obligatorios" });
    }

    const existente = await User.findByEmail(email);
    if (existente) {
      return res.status(409).json({ error: "ese correo ya esta registrado" });
    }

    const nuevoUsuario = await User.createUser({ name, email, password, role });
    return res.status(201).json({ message: "usuario creado", id: nuevoUsuario.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "error al registrar usuario" });
  }
});

// iniciar sesion
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "correo o contrasena incorrectos" });
    }

    const passwordValido = await bcrypt.compare(password, user.password_hash);
    if (!passwordValido) {
      return res.status(401).json({ error: "correo o contrasena incorrectos" });
    }

    const token = generateToken(user);

    // guardamos el token en una cookie http only
    // esto significa que el navegador no deja que javascript la lea
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE_MS,
      sameSite: "lax",
    });

    return res.status(200).json({ message: "sesion iniciada", user: User.toSafeObject(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "error al iniciar sesion" });
  }
});

// cerrar sesion, simplemente borramos la cookie
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({ message: "sesion cerrada" });
});

// devuelve los datos del usuario logueado, ruta protegida
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "usuario no encontrado" });
  }
  return res.status(200).json(User.toSafeObject(user));
});

// endpoint interno que usan los demas microservicios y el api gateway
// para verificar si un token es valido, sin tener que repetir la logica de jwt
// en cada servicio. recibe el token en el body
router.post("/verify", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: "no se envio token" });
  }

  const { verifyToken } = require("../utils/jwt");

  try {
    const payload = verifyToken(token);
    return res.status(200).json({ valid: true, user: payload });
  } catch (error) {
    return res.status(401).json({ valid: false, error: "token invalido o expirado" });
  }
});

module.exports = router;
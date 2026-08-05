import { Request, Response } from 'express';
import {
  UserService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from '../services/user.service';
import { JwtService } from '../services/jwt.service';
import { COOKIE_NAME, getCookieOptions } from '../config/cookie.config';

const userService = new UserService();
const jwtService = new JwtService();

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ message: 'Todos los campos son obligatorios.' });
      return;
    }
    if (role !== 'admin' && role !== 'cliente') {
      res.status(400).json({ message: 'El rol debe ser "admin" o "cliente".' });
      return;
    }

    const user = await userService.register({ name, email, password, role });
    res.status(201).json({ message: 'Usuario registrado correctamente.', user });
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      res.status(409).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error interno al registrar el usuario.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
      return;
    }

    const user = await userService.login({ email, password });
    const token = jwtService.sign({ userId: user.id, role: user.role });

    res.cookie(COOKIE_NAME, token, getCookieOptions());
    res.status(200).json({ message: 'Login exitoso.', user });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error interno al iniciar sesión.' });
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME);
  res.status(200).json({ message: 'Sesión cerrada.' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.userId;
  const user = await userService.findById(userId);

  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado.' });
    return;
  }
  res.status(200).json({ user });
}
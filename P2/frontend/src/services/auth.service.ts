import { api } from './api';

export type UserRole = 'admin' | 'cliente';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  register(payload: RegisterPayload) {
    return api.post<{ message: string; user: User }>('/auth/register', payload);
  },

  login(payload: LoginPayload) {
    return api.post<{ message: string; user: User }>('/auth/login', payload);
  },

  logout() {
    return api.post<{ message: string }>('/auth/logout', {});
  },

  me() {
    return api.get<{ user: User }>('/auth/me');
  },
};
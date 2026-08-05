import { api } from './api';

export const resourcesService = {
  getRoute1() {
    return api.get<{ message: string; role: string }>('/route1');
  },
  getRoute2() {
    return api.get<{ message: string; role: string }>('/route2');
  },
};
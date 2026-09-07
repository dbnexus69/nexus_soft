import api from './client';
import { User } from '../types';

export async function listUsers(params: Record<string, unknown>) {
  const res = await api.get('/users', { params });
  return res.data;
}

export async function getUser(id: number) {
  const res = await api.get(`/users/${id}`);
  return res.data.data;
}

export async function createUser(data: Partial<User>) {
  const res = await api.post('/users', data);
  return res.data.data;
}

export async function updateUser(id: number, data: Partial<User>) {
  const res = await api.put(`/users/${id}`, data);
  return res.data.data;
}

export interface ResultadoBaja {
  message: string;
  /** true si el usuario se borró de verdad; false si solo se inhabilitó. */
  deleted: boolean;
  /** Por qué no se pudo borrar, cuando `deleted` es false. */
  reason?: string;
  history?: { sales: number; clients: number; packages: number };
}

/**
 * Da de baja a un usuario.
 *
 * Devuelve qué ocurrió: un usuario sin historial se borra, y uno con ventas o
 * clientes a su nombre se inhabilita para no dejar esos registros sin autor.
 * Antes el endpoint respondía 204 y la pantalla decía siempre lo mismo, así
 * que no había forma de distinguir una cosa de la otra.
 */
export async function deleteUser(id: number): Promise<ResultadoBaja> {
  const res = await api.delete(`/users/${id}`);
  return res.data.data;
}


export async function updateRolePermissions(role: string, permissions: Record<string, unknown>) {
  const res = await api.put(`/roles/${role}/permissions`, { permissions });
  return res.data.data;
}

/**
 * El esquema de permisos: qué módulos y acciones existen.
 *
 * La rejilla llevaba su propia lista de módulos y declaraba cuatro de los
 * nueve. Ahora la pide, así que añadir un módulo en el backend no obliga a
 * tocar el frontend y no hay dos listas que puedan discrepar.
 */
export async function getRolesSchema() {
  const res = await api.get('/roles/schema');
  return res.data.data;
}

export async function getRolePermissions(role: string) {
  const res = await api.get(`/roles/${role}/permissions`);
  return res.data.data;
}

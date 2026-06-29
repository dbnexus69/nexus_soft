import { useState, useCallback } from 'react';
import { listUsers, createUser, updateUser, deleteUser, updateUserPermissions, getRolePermissions, updateRolePermissions } from '../api/users';
import { User } from '../types';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers({ search: searchTerm, role: roleFilter });
      if (res.success && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar usuarios';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter]);

  const handleCreateUser = async (data: Partial<User>) => {
    setLoading(true);
    try {
      const newUser = await createUser(data);
      await fetchUsers();
      return newUser;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id: number, data: Partial<User>) => {
    setLoading(true);
    try {
      const updated = await updateUser(id, data);
      await fetchUsers();
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar usuario';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await deleteUser(id);
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar usuario';
      throw new Error(msg);
    }
  };

  const handleSaveUserPermissions = async (id: number, permissions: Record<string, unknown>) => {
    try {
      await updateUserPermissions(id, permissions);
      await fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar permisos';
      throw new Error(msg);
    }
  };

  const handleFetchRolePermissions = async (role: string) => {
    return await getRolePermissions(role);
  };

  const handleSaveRolePermissions = async (role: string, permissions: Record<string, unknown>) => {
    return await updateRolePermissions(role, permissions);
  };

  return {
    users,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    fetchUsers,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleSaveUserPermissions,
    handleFetchRolePermissions,
    handleSaveRolePermissions
  };
}

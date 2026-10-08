import apiClient from './client';
import { User, UpdateProfileDto } from '@/types';

export const getProfile = async (): Promise<User> => {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
};

// Si se cambia la contraseña, el backend devuelve un token nuevo (los anteriores quedan inválidos)
export const updateProfile = async (
  dto: UpdateProfileDto,
): Promise<{ user: User; token?: string }> => {
  const { data } = await apiClient.put<{ user: User; token?: string }>('/auth/me', dto);
  return data;
};

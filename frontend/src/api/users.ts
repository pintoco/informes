import apiClient from './client';
import { User } from '@/types';

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  phone?: string;
  role?: 'ADMIN' | 'TECHNICIAN';
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  role?: 'ADMIN' | 'TECHNICIAN';
  password?: string;
}

export const listUsers = async (): Promise<User[]> => {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
};

export const createUser = async (dto: CreateUserDto): Promise<User> => {
  const { data } = await apiClient.post<User>('/users', dto);
  return data;
};

export const updateUser = async (id: string, dto: UpdateUserDto): Promise<User> => {
  const { data } = await apiClient.put<User>(`/users/${id}`, dto);
  return data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await apiClient.delete(`/users/${id}`);
};

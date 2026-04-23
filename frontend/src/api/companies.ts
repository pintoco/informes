import apiClient from './client';
import { Company, Location } from '@/types';

export const listCompanies = async (): Promise<Company[]> => {
  const { data } = await apiClient.get<Company[]>('/companies');
  return data;
};

export const createCompany = async (name: string): Promise<Company> => {
  const { data } = await apiClient.post<Company>('/companies', { name });
  return data;
};

export const updateCompany = async (id: string, name: string): Promise<Company> => {
  const { data } = await apiClient.put<Company>(`/companies/${id}`, { name });
  return data;
};

export const deleteCompany = async (id: string): Promise<void> => {
  await apiClient.delete(`/companies/${id}`);
};

export const addLocation = async (companyId: string, name: string): Promise<Location> => {
  const { data } = await apiClient.post<Location>(`/companies/${companyId}/locations`, { name });
  return data;
};

export const deleteLocation = async (companyId: string, locationId: string): Promise<void> => {
  await apiClient.delete(`/companies/${companyId}/locations/${locationId}`);
};

import apiClient from './client';
import {
  Service,
  PaginatedResponse,
  ServiceFilters,
  CreateServiceDto,
} from '@/types';

export const listServices = async (
  filters: ServiceFilters = {}
): Promise<PaginatedResponse<Service>> => {
  const params = new URLSearchParams();
  if (filters.ubicacion) params.append('ubicacion', filters.ubicacion);
  if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
  if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));

  const { data } = await apiClient.get<PaginatedResponse<Service>>(
    `/services?${params.toString()}`
  );
  return data;
};

export const getService = async (id: string): Promise<Service> => {
  const { data } = await apiClient.get<Service>(`/services/${id}`);
  return data;
};

export const createService = async (dto: CreateServiceDto): Promise<Service> => {
  const { data } = await apiClient.post<Service>('/services', dto);
  return data;
};

export const updateService = async (
  id: string,
  dto: Partial<CreateServiceDto>
): Promise<Service> => {
  const { data } = await apiClient.put<Service>(`/services/${id}`, dto);
  return data;
};

export const deleteService = async (id: string): Promise<void> => {
  await apiClient.delete(`/services/${id}`);
};

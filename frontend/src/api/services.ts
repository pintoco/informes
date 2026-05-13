import apiClient from './client';
import {
  Service,
  PaginatedResponse,
  ServiceFilters,
  CreateServiceDto,
  StatsResponse,
} from '@/types';

function buildParams(filters: ServiceFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.ubicacion) params.append('ubicacion', filters.ubicacion);
  if (filters.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
  if (filters.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
  if (filters.search) params.append('search', filters.search);
  if (filters.nombreTecnico) params.append('nombreTecnico', filters.nombreTecnico);
  if (filters.tipoMantenimiento) params.append('tipoMantenimiento', filters.tipoMantenimiento);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  return params;
}

export const listServices = async (
  filters: ServiceFilters = {}
): Promise<PaginatedResponse<Service>> => {
  const { data } = await apiClient.get<PaginatedResponse<Service>>(
    `/services?${buildParams(filters).toString()}`
  );
  return data;
};

export const getStats = async (): Promise<StatsResponse> => {
  const { data } = await apiClient.get<StatsResponse>('/services/stats');
  return data;
};

export const exportServicesCsv = async (filters: ServiceFilters = {}): Promise<void> => {
  const response = await apiClient.get(`/services/export?${buildParams(filters).toString()}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'servicios.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const cloneService = async (id: string): Promise<Service> => {
  const { data } = await apiClient.post<Service>(`/services/${id}/clone`);
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

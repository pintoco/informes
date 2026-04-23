import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
} from '@/api/services';
import {
  Service,
  PaginatedResponse,
  ServiceFilters,
  CreateServiceDto,
} from '@/types';

export function useServices() {
  const [services, setServices] = useState<PaginatedResponse<Service> | null>(null);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async (filters: ServiceFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listServices(filters);
      setServices(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar servicios';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchService = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getService(id);
      setCurrentService(data);
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar servicio';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (dto: CreateServiceDto): Promise<Service | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await createService(dto);
      toast.success('Servicio creado exitosamente');
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear servicio';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(
    async (id: string, dto: Partial<CreateServiceDto>): Promise<Service | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await updateService(id, dto);
        setCurrentService(data);
        toast.success('Servicio actualizado exitosamente');
        return data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al actualizar servicio';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteService(id);
      toast.success('Servicio eliminado exitosamente');
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar servicio';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    services,
    currentService,
    loading,
    error,
    fetchServices,
    fetchService,
    create,
    update,
    remove,
  };
}

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ServiceFilters } from '@/components/ServiceFilters';
import { Layout } from '@/components/Layout';
import { useServices } from '@/hooks/useServices';
import { Service, ServiceFilters as IServiceFilters, PdfStatus } from '@/types';

const pdfStatusConfig: Record<
  PdfStatus,
  { label: string; variant: 'warning' | 'info' | 'success' | 'error' | 'outline' }
> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  PROCESSING: { label: 'Procesando', variant: 'info' },
  READY: { label: 'Listo', variant: 'success' },
  ERROR: { label: 'Error', variant: 'error' },
};

const maintenanceLabels: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  INSTALLATION: 'Instalación',
  OTHER: 'Otro',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { services, loading, fetchServices, remove } = useServices();
  const [filters, setFilters] = useState<IServiceFilters>({ page: 1, limit: 20 });
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchServices(filters);
  }, [filters, fetchServices]);

  const handleFilter = useCallback((newFilters: IServiceFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await remove(deleteTarget.id);
    if (success) {
      setDeleteTarget(null);
      fetchServices(filters);
    }
    setDeleting(false);
  };

  const latestPdfStatus = (service: Service) => {
    if (!service.pdfs || service.pdfs.length === 0) return null;
    return service.pdfs[service.pdfs.length - 1];
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Servicios Técnicos</h1>
            <p className="text-gray-500 text-sm mt-1">
              {services?.total ?? 0} registros totales
            </p>
          </div>
          <Button onClick={() => navigate('/services/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Servicio
          </Button>
        </div>

        {/* Filters */}
        <ServiceFilters onFilter={handleFilter} loading={loading} />

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Orden de Trabajo</TableHead>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                        No se encontraron servicios
                      </TableCell>
                    </TableRow>
                  ) : (
                    services?.data.map((service) => {
                      const pdf = latestPdfStatus(service);
                      const pdfConfig = pdf ? pdfStatusConfig[pdf.status] : null;
                      return (
                        <TableRow key={service.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{service.ordenTrabajo}</TableCell>
                          <TableCell>{service.razonSocial}</TableCell>
                          <TableCell className="text-gray-600">{service.ubicacion}</TableCell>
                          <TableCell className="text-gray-600">
                            {format(new Date(service.fecha), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell className="text-gray-600">{service.nombreTecnico}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {maintenanceLabels[service.tipoMantenimiento] || service.tipoMantenimiento}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pdfConfig ? (
                              <Badge variant={pdfConfig.variant}>{pdfConfig.label}</Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">Sin PDF</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/services/${service.id}`)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/services/${service.id}/edit`)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteTarget(service)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {services && services.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Página {services.page} de {services.totalPages} ({services.total} registros)
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(services.page - 1)}
                      disabled={services.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(services.page + 1)}
                      disabled={services.page >= services.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el servicio{' '}
              <strong>{deleteTarget?.ordenTrabajo}</strong> de{' '}
              <strong>{deleteTarget?.razonSocial}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

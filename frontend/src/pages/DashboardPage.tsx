import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Eye, Edit, Trash2, ChevronLeft, ChevronRight,
  Download, CheckCircle, MapPin, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseServiceDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ServiceFilters } from '@/components/ServiceFilters';
import { DashboardInsights } from '@/components/DashboardInsights';
import { Layout } from '@/components/Layout';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/store/authStore';
import { getStats, exportServicesCsv, bulkDownloadPdfs } from '@/api/services';
import { Service, ServiceFilters as IServiceFilters, PdfStatus, StatsResponse } from '@/types';

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
  const [activeFilters, setActiveFilters] = useState<IServiceFilters>({});
  // Solo ADMIN puede eliminar servicios (el backend también lo exige)
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  // Filtro aplicado desde "Fallas recurrentes": muestra todas las visitas a un punto
  const [pointFilter, setPointFilter] = useState<{ razonSocial: string; ubicacion: string } | null>(null);

  useEffect(() => {
    fetchServices(filters);
  }, [filters, fetchServices]);

  useEffect(() => {
    getStats().then(setStats).catch(() => null);
  }, []);

  const handleFilter = useCallback((newFilters: IServiceFilters) => {
    const merged = { ...newFilters, page: 1, limit: filters.limit };
    setActiveFilters(newFilters);
    setFilters(merged);
    setSelectedIds(new Set());
    setPointFilter(null);
  }, [filters.limit]);

  const handleFilterPoint = useCallback((razonSocial: string, ubicacion: string) => {
    const pointFilters = { search: razonSocial, ubicacion };
    setActiveFilters(pointFilters);
    setFilters({ ...pointFilters, page: 1, limit: filters.limit });
    setSelectedIds(new Set());
    setPointFilter({ razonSocial, ubicacion });
  }, [filters.limit]);

  const clearPointFilter = () => handleFilter({});

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
      getStats().then(setStats).catch(() => null);
    }
    setDeleting(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportServicesCsv(activeFilters);
      toast.success('CSV exportado correctamente');
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!services?.data) return;
    if (selectedIds.size === services.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(services.data.map((s) => s.id)));
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      await bulkDownloadPdfs(Array.from(selectedIds));
      toast.success(`ZIP descargado con los informes seleccionados`);
    } catch {
      toast.error('Error al descargar los PDFs');
    } finally {
      setBulkDownloading(false);
    }
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
            <p className="text-gray-500 text-sm mt-1">{services?.total ?? 0} registros totales</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
            <Button onClick={() => navigate('/services/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Servicio
            </Button>
          </div>
        </div>

        {/* Resumen: este mes por cliente, informes por revisar y fallas recurrentes */}
        {stats && <DashboardInsights stats={stats} onFilterPoint={handleFilterPoint} />}

        {/* Filters */}
        <ServiceFilters onFilter={handleFilter} loading={loading} />

        {pointFilter && (
          <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">
            <span className="flex items-center gap-1 text-red-800">
              <MapPin className="h-4 w-4" />
              Visitas a <strong>{pointFilter.ubicacion}</strong> ({pointFilter.razonSocial})
            </span>
            <Button size="sm" variant="ghost" onClick={clearPointFilter} className="text-red-700">
              <X className="h-4 w-4 mr-1" />
              Quitar filtro
            </Button>
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-sm text-blue-700 font-medium">
              {selectedIds.size} servicio{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds(new Set())}
                className="text-blue-700 border-blue-300"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleBulkDownload}
                disabled={bulkDownloading}
              >
                <Download className="h-4 w-4 mr-1" />
                {bulkDownloading ? 'Descargando...' : `Descargar PDFs (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        )}

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
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 cursor-pointer"
                        checked={!!services?.data.length && selectedIds.size === services.data.length}
                        onChange={toggleSelectAll}
                        title="Seleccionar todos"
                      />
                    </TableHead>
                    <TableHead>Orden de Trabajo</TableHead>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-gray-500 py-12">
                        No se encontraron servicios
                      </TableCell>
                    </TableRow>
                  ) : (
                    services?.data.map((service) => {
                      const pdf = latestPdfStatus(service);
                      const pdfConfig = pdf ? pdfStatusConfig[pdf.status] : null;
                      return (
                        <TableRow key={service.id} className={`hover:bg-gray-50 ${selectedIds.has(service.id) ? 'bg-blue-50' : ''}`}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 cursor-pointer"
                              checked={selectedIds.has(service.id)}
                              onChange={() => toggleSelect(service.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{service.ordenTrabajo}</TableCell>
                          <TableCell>{service.razonSocial}</TableCell>
                          <TableCell className="text-gray-600">{service.ubicacion}</TableCell>
                          <TableCell className="text-gray-600">
                            {format(parseServiceDate(service.fecha), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell className="text-gray-600">{service.responsable}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {maintenanceLabels[service.tipoMantenimiento] || service.tipoMantenimiento}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {service.firmaUrl ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Firmado
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-xs">Sin firma</span>
                            )}
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
                                variant="ghost" size="icon"
                                onClick={() => navigate(`/services/${service.id}`)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                onClick={() => navigate(`/services/${service.id}/edit`)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost" size="icon"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteTarget(service)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
                      variant="outline" size="sm"
                      onClick={() => handlePageChange(services.page - 1)}
                      disabled={services.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline" size="sm"
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

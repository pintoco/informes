import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ServiceFilters as IServiceFilters, MaintenanceType } from '@/types';

interface ServiceFiltersProps {
  onFilter: (filters: IServiceFilters) => void;
  loading?: boolean;
}

const maintenanceOptions: { value: MaintenanceType; label: string }[] = [
  { value: 'PREVENTIVE', label: 'Preventivo' },
  { value: 'CORRECTIVE', label: 'Correctivo' },
  { value: 'INSTALLATION', label: 'Instalación' },
  { value: 'OTHER', label: 'Otro' },
];

export function ServiceFilters({ onFilter, loading }: ServiceFiltersProps) {
  const [ubicacion, setUbicacion] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [search, setSearch] = useState('');
  const [nombreTecnico, setNombreTecnico] = useState('');
  const [tipoMantenimiento, setTipoMantenimiento] = useState<MaintenanceType | ''>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter({
      ubicacion: ubicacion || undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      search: search || undefined,
      nombreTecnico: nombreTecnico || undefined,
      tipoMantenimiento: tipoMantenimiento || undefined,
      page: 1,
    });
  };

  const handleClear = () => {
    setUbicacion('');
    setFechaDesde('');
    setFechaHasta('');
    setSearch('');
    setNombreTecnico('');
    setTipoMantenimiento('');
    onFilter({ page: 1 });
  };

  const hasFilters = ubicacion || fechaDesde || fechaHasta || search || nombreTecnico || tipoMantenimiento;

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="search">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="OT, Razón Social..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="ubicacion">Ubicación</Label>
          <Input
            id="ubicacion"
            placeholder="Ciudad o dirección..."
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="nombreTecnico">Técnico</Label>
          <Input
            id="nombreTecnico"
            placeholder="Nombre del técnico..."
            value={nombreTecnico}
            onChange={(e) => setNombreTecnico(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="fechaDesde">Fecha Desde</Label>
          <Input
            id="fechaDesde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="fechaHasta">Fecha Hasta</Label>
          <Input
            id="fechaHasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="tipoMantenimiento">Tipo</Label>
          <select
            id="tipoMantenimiento"
            value={tipoMantenimiento}
            onChange={(e) => setTipoMantenimiento(e.target.value as MaintenanceType | '')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Todos los tipos</option>
            {maintenanceOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-2 mt-4">
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="text-gray-500">
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
        <Button type="submit" disabled={loading} size="sm">
          <Search className="h-4 w-4 mr-1" />
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>
    </form>
  );
}

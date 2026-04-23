import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateServiceDto, MaintenanceType, Service, Company } from '@/types';
import { listCompanies } from '@/api/companies';
import { useAuthStore } from '@/store/authStore';

interface ServiceFormProps {
  initialData?: Partial<Service>;
  onSubmit: (dto: CreateServiceDto) => Promise<void>;
  loading?: boolean;
}

const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  INSTALLATION: 'Instalación',
  OTHER: 'Otro',
};

const defaultValues: CreateServiceDto = {
  razonSocial: '',
  ubicacion: '',
  contactoTerreno: '',
  ordenTrabajo: '',
  fecha: new Date().toISOString().split('T')[0],
  horaInicio: '',
  responsable: '',
  nombreTecnico: '',
  fono: '',
  email: '',
  tipoMantenimiento: 'PREVENTIVE',
  comentarioNvr: '',
  comentarioCamaras: '',
  observaciones: '',
};

export function ServiceForm({ initialData, onSubmit, loading }: ServiceFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<CreateServiceDto>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateServiceDto, string>>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    listCompanies().then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        razonSocial: initialData.razonSocial || '',
        ubicacion: initialData.ubicacion || '',
        contactoTerreno: initialData.contactoTerreno || '',
        ordenTrabajo: initialData.ordenTrabajo || '',
        fecha: initialData.fecha ? initialData.fecha.split('T')[0] : defaultValues.fecha,
        horaInicio: initialData.horaInicio || '',
        responsable: initialData.responsable || '',
        nombreTecnico: initialData.nombreTecnico || '',
        fono: initialData.fono || '',
        email: initialData.email || '',
        tipoMantenimiento: initialData.tipoMantenimiento || 'PREVENTIVE',
        comentarioNvr: initialData.comentarioNvr || '',
        comentarioCamaras: initialData.comentarioCamaras || '',
        observaciones: initialData.observaciones || '',
        firmaUrl: initialData.firmaUrl || undefined,
      });
    } else if (user) {
      // Auto-fill technician data from logged-in user
      setFormData(prev => ({
        ...prev,
        responsable: user.name || '',
        nombreTecnico: user.name || '',
        fono: user.phone || '',
        email: user.email || '',
      }));
    }
  }, [initialData, user]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const locations = selectedCompany?.locations ?? [];

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const company = companies.find(c => c.id === companyId);
    if (company) {
      updateField('razonSocial', company.name);
      updateField('ubicacion', '');
    }
  };

  const updateField = (field: keyof CreateServiceDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreateServiceDto, string>> = {};

    if (!formData.razonSocial.trim()) newErrors.razonSocial = 'Campo requerido';
    if (!formData.ubicacion.trim()) newErrors.ubicacion = 'Campo requerido';
    if (!formData.contactoTerreno.trim()) newErrors.contactoTerreno = 'Campo requerido';
    if (!formData.ordenTrabajo.trim()) newErrors.ordenTrabajo = 'Campo requerido';
    if (!formData.fecha) newErrors.fecha = 'Campo requerido';
    if (!formData.horaInicio.trim()) newErrors.horaInicio = 'Campo requerido';
    if (!formData.responsable.trim()) newErrors.responsable = 'Campo requerido';
    if (!formData.nombreTecnico.trim()) newErrors.nombreTecnico = 'Campo requerido';
    if (!formData.fono.trim()) newErrors.fono = 'Campo requerido';
    if (!formData.email.trim()) newErrors.email = 'Campo requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const dto: CreateServiceDto = {
      ...formData,
      comentarioNvr: formData.comentarioNvr || undefined,
      comentarioCamaras: formData.comentarioCamaras || undefined,
      observaciones: formData.observaciones || undefined,
    };

    await onSubmit(dto);
  };

  const required = (
    <span className="text-red-500 ml-1" title="Requerido">
      *
    </span>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Información del Cliente
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="razonSocial">
              Razón Social{required}
            </Label>
            {companies.length > 0 ? (
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger id="razonSocial">
                  <SelectValue placeholder="Seleccionar empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="razonSocial"
                value={formData.razonSocial}
                onChange={(e) => updateField('razonSocial', e.target.value)}
                placeholder="Empresa S.A."
              />
            )}
            {errors.razonSocial && (
              <p className="text-sm text-red-500">{errors.razonSocial}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ubicacion">
              Ubicación{required}
            </Label>
            {selectedCompanyId && locations.length > 0 ? (
              <Select value={formData.ubicacion} onValueChange={(v) => updateField('ubicacion', v)}>
                <SelectTrigger id="ubicacion">
                  <SelectValue placeholder="Seleccionar ubicación..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="ubicacion"
                value={formData.ubicacion}
                onChange={(e) => updateField('ubicacion', e.target.value)}
                placeholder="Ciudad, dirección..."
              />
            )}
            {errors.ubicacion && (
              <p className="text-sm text-red-500">{errors.ubicacion}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactoTerreno">
              Contacto Terreno{required}
            </Label>
            <Input
              id="contactoTerreno"
              value={formData.contactoTerreno}
              onChange={(e) => updateField('contactoTerreno', e.target.value)}
              placeholder="Nombre del contacto"
            />
            {errors.contactoTerreno && (
              <p className="text-sm text-red-500">{errors.contactoTerreno}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ordenTrabajo">
              Orden de Trabajo{required}
            </Label>
            <Input
              id="ordenTrabajo"
              value={formData.ordenTrabajo}
              onChange={(e) => updateField('ordenTrabajo', e.target.value)}
              placeholder="OT-001"
            />
            {errors.ordenTrabajo && (
              <p className="text-sm text-red-500">{errors.ordenTrabajo}</p>
            )}
          </div>
        </div>
      </div>

      {/* Service Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Detalles del Servicio
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="fecha">
              Fecha{required}
            </Label>
            <Input
              id="fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => updateField('fecha', e.target.value)}
            />
            {errors.fecha && <p className="text-sm text-red-500">{errors.fecha}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="horaInicio">
              Hora de Inicio{required}
            </Label>
            <Input
              id="horaInicio"
              type="time"
              value={formData.horaInicio}
              onChange={(e) => updateField('horaInicio', e.target.value)}
            />
            {errors.horaInicio && (
              <p className="text-sm text-red-500">{errors.horaInicio}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="tipoMantenimiento">
              Tipo de Mantenimiento{required}
            </Label>
            <Select
              value={formData.tipoMantenimiento}
              onValueChange={(v) => updateField('tipoMantenimiento', v as MaintenanceType)}
            >
              <SelectTrigger id="tipoMantenimiento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(maintenanceTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Technician Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Datos del Técnico
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="responsable">
              Responsable{required}
            </Label>
            <Input
              id="responsable"
              value={formData.responsable}
              onChange={(e) => updateField('responsable', e.target.value)}
              placeholder="Nombre del responsable"
            />
            {errors.responsable && (
              <p className="text-sm text-red-500">{errors.responsable}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="nombreTecnico">
              Nombre del Técnico{required}
            </Label>
            <Input
              id="nombreTecnico"
              value={formData.nombreTecnico}
              onChange={(e) => updateField('nombreTecnico', e.target.value)}
              placeholder="Nombre completo"
            />
            {errors.nombreTecnico && (
              <p className="text-sm text-red-500">{errors.nombreTecnico}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="fono">
              Teléfono{required}
            </Label>
            <Input
              id="fono"
              type="tel"
              value={formData.fono}
              onChange={(e) => updateField('fono', e.target.value)}
              placeholder="+56 9 1234 5678"
            />
            {errors.fono && <p className="text-sm text-red-500">{errors.fono}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">
              Email{required}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="tecnico@empresa.com"
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>
        </div>
      </div>

      {/* Technical Comments */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Comentarios Técnicos
        </h3>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="comentarioNvr">Comentario NVR</Label>
            <Textarea
              id="comentarioNvr"
              value={formData.comentarioNvr || ''}
              onChange={(e) => updateField('comentarioNvr', e.target.value)}
              placeholder="Estado y observaciones del NVR..."
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="comentarioCamaras">Comentario Cámaras</Label>
            <Textarea
              id="comentarioCamaras"
              value={formData.comentarioCamaras || ''}
              onChange={(e) => updateField('comentarioCamaras', e.target.value)}
              placeholder="Estado y observaciones de las cámaras..."
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="observaciones">Observaciones Generales</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones || ''}
              onChange={(e) => updateField('observaciones', e.target.value)}
              placeholder="Observaciones adicionales del servicio..."
              rows={4}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? 'Guardando...' : 'Guardar Servicio'}
        </Button>
      </div>
    </form>
  );
}

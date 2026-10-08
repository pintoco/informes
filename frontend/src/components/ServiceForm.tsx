import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Mail, Phone, Plus, User as UserIcon } from 'lucide-react';
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
import { CreateServiceDto, MaintenanceType, Service, Company, TextTemplate } from '@/types';
import { listCompanies } from '@/api/companies';
import { listTextTemplates } from '@/api/textTemplates';
import { useAuthStore } from '@/store/authStore';

interface ServiceFormProps {
  initialData?: Partial<Service>;
  onSubmit: (dto: CreateServiceDto) => Promise<void>;
  loading?: boolean;
  isEdit?: boolean;
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
  fecha: new Date().toISOString().split('T')[0],
  horaInicio: '',
  tipoMantenimiento: 'PREVENTIVE',
  comentarioNvr: '',
  comentarioCamaras: '',
  observaciones: '',
};

type CommentField = 'comentarioNvr' | 'comentarioCamaras' | 'observaciones';

/** Lista desplegable que agrega un texto predefinido al final del campo. */
function TemplatePicker({
  templates,
  onInsert,
}: {
  templates: TextTemplate[];
  onInsert: (body: string) => void;
}) {
  if (templates.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => {
        const tpl = templates.find((t) => t.id === e.target.value);
        if (tpl) onInsert(tpl.body);
      }}
      className="h-8 max-w-[60%] rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-600 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      title="Insertar un texto predefinido"
    >
      <option value="">+ Insertar texto predefinido…</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>{t.title}</option>
      ))}
    </select>
  );
}

export function ServiceForm({ initialData, onSubmit, loading, isEdit = false }: ServiceFormProps) {
  const { user, refreshUser } = useAuthStore();
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [showNvr, setShowNvr] = useState(false);
  const [formData, setFormData] = useState<CreateServiceDto>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateServiceDto, string>>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  useEffect(() => {
    listCompanies().then(setCompanies).catch(() => {});
    listTextTemplates().then(setTemplates).catch(() => {});
    // Los datos del responsable salen del perfil: se recarga por si cambió
    if (!isEdit) refreshUser();
  }, [isEdit, refreshUser]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        razonSocial: initialData.razonSocial || '',
        ubicacion: initialData.ubicacion || '',
        contactoTerreno: initialData.contactoTerreno || '',
        ordenTrabajo: initialData.ordenTrabajo || '',
        fecha: initialData.fecha ? initialData.fecha.split('T')[0] : defaultValues.fecha,
        horaInicio: initialData.horaInicio || '',
        tipoMantenimiento: initialData.tipoMantenimiento || 'PREVENTIVE',
        comentarioNvr: initialData.comentarioNvr || '',
        comentarioCamaras: initialData.comentarioCamaras || '',
        observaciones: initialData.observaciones || '',
      });
      if (initialData.comentarioNvr) setShowNvr(true);
    }
  }, [initialData]);

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

  const insertTemplate = (field: CommentField, body: string) => {
    const current = (formData[field] || '').trimEnd();
    updateField(field, current ? `${current}\n\n${body}` : body);
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
    if (!formData.fecha) newErrors.fecha = 'Campo requerido';
    if (!formData.horaInicio.trim()) newErrors.horaInicio = 'Campo requerido';

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
      comentarioNvr: isEdit ? formData.comentarioNvr : (formData.comentarioNvr || undefined),
      comentarioCamaras: isEdit ? formData.comentarioCamaras : (formData.comentarioCamaras || undefined),
      observaciones: isEdit ? formData.observaciones : (formData.observaciones || undefined),
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

          {isEdit && (
            <div className="space-y-1">
              <Label>Orden de Trabajo</Label>
              <p className="text-sm font-medium text-gray-900 border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                {formData.ordenTrabajo || '—'}
              </p>
            </div>
          )}
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

      {/* Responsable: datos del perfil del usuario (no editables aquí) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold text-gray-900">Responsable del Servicio</h3>
          {!isEdit && (
            <Link to="/profile" className="text-sm text-blue-600 hover:underline">
              Editar mis datos
            </Link>
          )}
        </div>
        {(() => {
          const nombre = isEdit ? initialData?.responsable : user?.name;
          const fono = isEdit ? initialData?.fono : user?.phone;
          const email = isEdit ? initialData?.email : user?.contactEmail || user?.email;
          return (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{nombre || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className={fono ? 'text-gray-700' : 'text-gray-400'}>{fono || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700 break-all">{email || '—'}</span>
                </div>
              </div>
              {!isEdit && !fono && (
                <p className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Tu perfil no tiene teléfono y el informe saldrá sin él.{' '}
                  <Link to="/profile" className="underline font-medium">Agregarlo en Mi perfil</Link>
                </p>
              )}
              {!isEdit && (
                <p className="text-xs text-gray-500">
                  Se usan los datos de tu perfil. Aparecerán en el informe PDF.
                </p>
              )}
            </>
          );
        })()}
      </div>

      {/* Technical Comments */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Comentarios Técnicos
        </h3>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="comentarioCamaras">Comentario Cámaras</Label>
              <TemplatePicker templates={templates} onInsert={(t) => insertTemplate('comentarioCamaras', t)} />
            </div>
            <Textarea
              id="comentarioCamaras"
              value={formData.comentarioCamaras || ''}
              onChange={(e) => updateField('comentarioCamaras', e.target.value)}
              placeholder="Estado y observaciones de las cámaras..."
              rows={6}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="observaciones">Observaciones Generales</Label>
              <TemplatePicker templates={templates} onInsert={(t) => insertTemplate('observaciones', t)} />
            </div>
            <Textarea
              id="observaciones"
              value={formData.observaciones || ''}
              onChange={(e) => updateField('observaciones', e.target.value)}
              placeholder="Observaciones adicionales del servicio..."
              rows={6}
            />
          </div>

          {/* NVR: se usa poco, queda oculto hasta que se necesite */}
          {showNvr ? (
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
          ) : (
            <button
              type="button"
              onClick={() => setShowNvr(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <Plus className="h-4 w-4" />
              Agregar comentario NVR
            </button>
          )}
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

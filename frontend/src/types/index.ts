export type UserRole = 'ADMIN' | 'TECHNICIAN';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'INSTALLATION' | 'OTHER';
export type PhotoCategory = 'BEFORE' | 'AFTER';
export type PdfStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  // Email que aparece en los informes (si es distinto del email de acceso)
  contactEmail?: string | null;
  role: UserRole;
  createdAt?: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  contactEmail?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface TextTemplate {
  id: string;
  title: string;
  body: string;
  orden: number;
}

export interface Company {
  id: string;
  name: string;
  locations: Location[];
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  companyId: string;
  createdAt: string;
}

export interface Service {
  id: string;
  razonSocial: string;
  ubicacion: string;
  contactoTerreno: string;
  ordenTrabajo: string;
  fecha: string;
  horaInicio: string;
  responsable: string;
  // Histórico: los servicios nuevos no tienen técnico (el responsable es el usuario)
  nombreTecnico: string | null;
  fono: string;
  email: string;
  tipoMantenimiento: MaintenanceType;
  comentarioNvr: string | null;
  comentarioCamaras: string | null;
  observaciones: string | null;
  firmaUrl: string | null;
  firmaNombreReceptor: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  photos: ServicePhoto[];
  pdfs: ServicePdf[];
}

export interface ServicePhoto {
  id: string;
  serviceId: string;
  categoria: PhotoCategory;
  url: string;
  originalName: string;
  sizeBytes: number;
  orden: number;
  createdAt: string;
}

export interface ServicePdf {
  id: string;
  serviceId: string;
  version: number;
  status: PdfStatus;
  url: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ServiceFilters {
  ubicacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  tipoMantenimiento?: MaintenanceType;
  page?: number;
  limit?: number;
}

export interface AttentionItem {
  id: string;
  ordenTrabajo: string;
  razonSocial: string;
  ubicacion: string;
  fecha: string;
  issues: string[];
}

export interface RecurringPoint {
  razonSocial: string;
  ubicacion: string;
  correctivos: number;
  ultima: string;
}

export interface StatsResponse {
  total: number;
  thisMonth: number;
  thisMonthByClient: Array<{ razonSocial: string; count: number }>;
  attention: {
    windowDays: number;
    sinFirma: number;
    sinFotosDespues: number;
    sinPdf: number;
    pdfDesactualizado: number;
    totalItems: number;
    items: AttentionItem[];
  };
  recurringPoints: {
    windowDays: number;
    items: RecurringPoint[];
  };
}

export interface CreateServiceDto {
  razonSocial: string;
  ubicacion: string;
  contactoTerreno: string;
  ordenTrabajo?: string;
  fecha: string;
  horaInicio: string;
  // responsable, fono y email los completa el backend con el perfil del usuario
  tipoMantenimiento: MaintenanceType;
  comentarioNvr?: string;
  comentarioCamaras?: string;
  observaciones?: string;
  firmaUrl?: string;
  firmaNombreReceptor?: string;
}

export interface PresignedUrlRequest {
  filename: string;
  categoria: PhotoCategory;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  key: string;
}

export interface ConfirmPhotoUploadDto {
  key: string;
  originalName: string;
  categoria: PhotoCategory;
  orden: number;
}

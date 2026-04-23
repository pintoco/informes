export type UserRole = 'ADMIN' | 'TECHNICIAN';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'INSTALLATION' | 'OTHER';
export type PhotoCategory = 'BEFORE' | 'AFTER';
export type PdfStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  cognitoSub?: string;
  createdAt?: string;
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
  nombreTecnico: string;
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
  page?: number;
  limit?: number;
}

export interface CreateServiceDto {
  razonSocial: string;
  ubicacion: string;
  contactoTerreno: string;
  ordenTrabajo: string;
  fecha: string;
  horaInicio: string;
  responsable: string;
  nombreTecnico: string;
  fono: string;
  email: string;
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
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  key: string;
  url: string;
}

export interface ConfirmPhotoUploadDto {
  key: string;
  url: string;
  originalName: string;
  sizeBytes: number;
  categoria: PhotoCategory;
  orden: number;
}

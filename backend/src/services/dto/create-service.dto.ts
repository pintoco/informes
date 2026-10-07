import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

// La firma se guarda como data URL (generada por el canvas del frontend).
// Se valida el formato para que no pueda inyectar HTML en la plantilla del PDF.
export const SIGNATURE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const MAX_SIGNATURE_LENGTH = 700_000;

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  INSTALLATION = 'INSTALLATION',
  OTHER = 'OTHER',
}

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  razonSocial: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  ubicacion: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactoTerreno: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  ordenTrabajo?: string;

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  horaInicio: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  responsable: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombreTecnico: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  fono: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(MaintenanceType)
  tipoMantenimiento: MaintenanceType;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comentarioNvr?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comentarioCamaras?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  observaciones?: string;

  @IsString()
  @IsOptional()
  @MaxLength(MAX_SIGNATURE_LENGTH)
  @Matches(SIGNATURE_DATA_URL, { message: 'firmaUrl debe ser una imagen PNG/JPEG en formato data URL' })
  firmaUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  firmaNombreReceptor?: string;
}

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  razonSocial?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  ubicacion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  contactoTerreno?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  ordenTrabajo?: string;

  @IsDateString()
  @IsOptional()
  fecha?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  horaInicio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  responsable?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  nombreTecnico?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  fono?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(MaintenanceType)
  @IsOptional()
  tipoMantenimiento?: MaintenanceType;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comentarioNvr?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comentarioCamaras?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  observaciones?: string;

  @IsString()
  @IsOptional()
  @MaxLength(MAX_SIGNATURE_LENGTH)
  @Matches(SIGNATURE_DATA_URL, { message: 'firmaUrl debe ser una imagen PNG/JPEG en formato data URL' })
  firmaUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  firmaNombreReceptor?: string;
}

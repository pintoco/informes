import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
  firmaUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  firmaNombreReceptor?: string;
}

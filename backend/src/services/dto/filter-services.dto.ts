import { IsString, IsOptional, IsDateString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { MaintenanceType } from '@prisma/client';

export class FilterServicesDto {
  @IsString()
  @IsOptional()
  ubicacion?: string;

  @IsDateString()
  @IsOptional()
  fechaDesde?: string;

  @IsDateString()
  @IsOptional()
  fechaHasta?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  nombreTecnico?: string;

  @IsEnum(MaintenanceType)
  @IsOptional()
  tipoMantenimiento?: MaintenanceType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

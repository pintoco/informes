import { IsOptional, IsUUID, Matches } from 'class-validator';

export class MonthlyReportQueryDto {
  @IsUUID('4')
  companyId: string;

  // Primer día del período (YYYY-MM-DD). Sin `to`, debe coincidir con el día de inicio
  // de la institución y el período dura un mes.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from debe tener formato YYYY-MM-DD' })
  from: string;

  // Último día (inclusive) de un rango elegido a mano
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to debe tener formato YYYY-MM-DD' })
  to?: string;
}

export class CompanyQueryDto {
  @IsUUID('4')
  companyId: string;
}

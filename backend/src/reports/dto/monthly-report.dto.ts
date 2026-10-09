import { IsUUID, Matches } from 'class-validator';

export class MonthlyReportQueryDto {
  @IsUUID('4')
  companyId: string;

  // Primer día del período (YYYY-MM-DD); debe coincidir con el día de inicio de la institución
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from debe tener formato YYYY-MM-DD' })
  from: string;
}

export class CompanyQueryDto {
  @IsUUID('4')
  companyId: string;
}

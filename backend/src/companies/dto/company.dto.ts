import { IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Día del mes en que empieza el período del informe mensual (1–28 para que exista en todos los meses)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  periodStartDay?: number;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

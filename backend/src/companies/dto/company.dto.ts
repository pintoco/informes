import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'TECHNICIAN'])
  role?: 'ADMIN' | 'TECHNICIAN';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'TECHNICIAN'])
  role?: 'ADMIN' | 'TECHNICIAN';

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password?: string;
}

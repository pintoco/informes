import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, Matches } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MSG = 'La contraseña debe contener al menos una mayúscula, una minúscula y un número';

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
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
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
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MSG })
  password?: string;
}

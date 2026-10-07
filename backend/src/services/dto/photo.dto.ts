import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsIn,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { PhotoCategory } from '@prisma/client';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export class PresignPhotoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsEnum(PhotoCategory, {
    message: 'categoria debe ser BEFORE o AFTER',
  })
  categoria: PhotoCategory;

  @IsIn(ALLOWED_MIME_TYPES, {
    message: `contentType debe ser uno de: ${ALLOWED_MIME_TYPES.join(', ')}`,
  })
  contentType: AllowedMimeType;

  // Tamaño exacto del archivo: se firma en la URL, MinIO rechaza subidas de otro tamaño
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  sizeBytes: number;
}

export class ConfirmPhotoDto {
  // La key la genera el backend en /presign; aquí solo se valida su formato y pertenencia
  @IsString()
  @Matches(/^services\/[0-9a-f-]{36}\/photos\/(before|after)\/[0-9a-f-]{36}\.(jpg|png|webp)$/, {
    message: 'key inválida',
  })
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName: string;

  @IsEnum(PhotoCategory, {
    message: 'categoria debe ser BEFORE o AFTER',
  })
  categoria: PhotoCategory;

  @IsInt()
  @Min(0)
  @Max(29)
  orden: number;
}

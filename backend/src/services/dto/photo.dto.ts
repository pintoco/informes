import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { PhotoCategory } from '@prisma/client';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

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
}

export class ConfirmPhotoDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName: string;

  @IsNumber()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  sizeBytes: number;

  @IsEnum(PhotoCategory, {
    message: 'categoria debe ser BEFORE o AFTER',
  })
  categoria: PhotoCategory;

  @IsNumber()
  @Min(0)
  @Max(29)
  orden: number;
}

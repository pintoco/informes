import axios from 'axios';
import imageCompression from 'browser-image-compression';
// Copia local de la librería para el Web Worker (por defecto la baja de cdn.jsdelivr.net)
import imageCompressionLibUrl from 'browser-image-compression/dist/browser-image-compression.js?url';
import apiClient from './client';
import {
  PhotoCategory,
  PresignedUrlRequest,
  PresignedUrlResponse,
  ConfirmPhotoUploadDto,
  ServicePhoto,
} from '@/types';

export const getPresignedUrl = async (
  serviceId: string,
  req: PresignedUrlRequest
): Promise<PresignedUrlResponse> => {
  const { data } = await apiClient.post<PresignedUrlResponse>(
    `/services/${serviceId}/photos/presign`,
    req
  );
  return data;
};

export const confirmPhotoUpload = async (
  serviceId: string,
  dto: ConfirmPhotoUploadDto
): Promise<ServicePhoto> => {
  const { data } = await apiClient.post<ServicePhoto>(
    `/services/${serviceId}/photos/confirm`,
    dto
  );
  return data;
};

export const deletePhoto = async (
  serviceId: string,
  photoId: string
): Promise<void> => {
  await apiClient.delete(`/services/${serviceId}/photos/${photoId}`);
};

export const compressAndUpload = async (
  file: File,
  serviceId: string,
  categoria: PhotoCategory,
  orden: number,
  onProgress?: (progress: number) => void
): Promise<ServicePhoto> => {
  // Compress image client-side
  const compressionOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    libURL: new URL(imageCompressionLibUrl, window.location.origin).href,
    onProgress,
  };

  const compressedFile = await imageCompression(file, compressionOptions);

  // Get presigned URL
  const presignedData = await getPresignedUrl(serviceId, {
    filename: file.name,
    categoria,
    contentType: compressedFile.type || 'image/jpeg',
    sizeBytes: compressedFile.size,
  });

  // Upload directly to S3
  await axios.put(presignedData.presignedUrl, compressedFile, {
    headers: {
      'Content-Type': compressedFile.type || 'image/jpeg',
    },
  });

  // Confirm upload in backend
  const photo = await confirmPhotoUpload(serviceId, {
    key: presignedData.key,
    originalName: file.name,
    categoria,
    orden,
  });

  return photo;
};

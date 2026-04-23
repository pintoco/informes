import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { compressAndUpload, deletePhoto } from '@/api/photos';
import { ServicePhoto, PhotoCategory } from '@/types';

interface UploadState {
  [key: string]: number; // filename -> progress 0-100
}

export function usePhotos(serviceId: string) {
  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadState>({});
  const [error, setError] = useState<string | null>(null);

  const totalPhotos = photos.length;
  const MAX_PHOTOS = 30;

  const initPhotos = useCallback((existingPhotos: ServicePhoto[]) => {
    setPhotos(existingPhotos);
  }, []);

  const uploadPhoto = useCallback(
    async (file: File, categoria: PhotoCategory): Promise<ServicePhoto | null> => {
      if (totalPhotos >= MAX_PHOTOS) {
        toast.error(`Máximo ${MAX_PHOTOS} fotos permitidas`);
        return null;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten archivos de imagen');
        return null;
      }

      setUploading(true);
      setError(null);

      const orden = photos.filter((p) => p.categoria === categoria).length;

      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

        const photo = await compressAndUpload(
          file,
          serviceId,
          categoria,
          orden,
          (progress) => {
            setUploadProgress((prev) => ({ ...prev, [file.name]: progress }));
          }
        );

        setPhotos((prev) => [...prev, photo]);
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });

        toast.success('Foto subida exitosamente');
        return photo;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al subir foto';
        setError(message);
        toast.error(message);
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [serviceId, photos, totalPhotos]
  );

  const uploadMultiple = useCallback(
    async (files: File[], categoria: PhotoCategory): Promise<void> => {
      const available = MAX_PHOTOS - totalPhotos;
      if (available <= 0) {
        toast.error(`Máximo ${MAX_PHOTOS} fotos permitidas`);
        return;
      }

      const filesToUpload = Array.from(files).slice(0, available);
      if (filesToUpload.length < files.length) {
        toast.error(
          `Solo se subirán ${filesToUpload.length} de ${files.length} fotos (límite de ${MAX_PHOTOS})`
        );
      }

      for (const file of filesToUpload) {
        await uploadPhoto(file, categoria);
      }
    },
    [uploadPhoto, totalPhotos]
  );

  const removePhoto = useCallback(
    async (photoId: string): Promise<void> => {
      try {
        await deletePhoto(serviceId, photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        toast.success('Foto eliminada');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al eliminar foto';
        toast.error(message);
      }
    },
    [serviceId]
  );

  const photosByCategory = useCallback(
    (categoria: PhotoCategory) => photos.filter((p) => p.categoria === categoria),
    [photos]
  );

  return {
    photos,
    uploading,
    uploadProgress,
    error,
    totalPhotos,
    MAX_PHOTOS,
    initPhotos,
    uploadPhoto,
    uploadMultiple,
    removePhoto,
    photosByCategory,
  };
}

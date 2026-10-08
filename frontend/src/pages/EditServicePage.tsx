import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { ServiceForm } from '@/components/ServiceForm';
import { PhotoUploader } from '@/components/PhotoUploader';
import { SignatureCanvas } from '@/components/SignatureCanvas';
import { PdfStatus } from '@/components/PdfStatus';
import { useServices } from '@/hooks/useServices';
import { usePhotos } from '@/hooks/usePhotos';
import { updateService } from '@/api/services';
import { CreateServiceDto, PhotoCategory } from '@/types';

export function EditServicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentService, loading, fetchService, update } = useServices();
  const [saving, setSaving] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  // Cambios hechos en esta pantalla (datos, fotos, firma) para detectar PDF desactualizado
  const [lastChangeAt, setLastChangeAt] = useState<number | null>(null);

  const serviceId = id || '';
  const {
    photos,
    uploading,
    uploadProgress,
    totalPhotos,
    MAX_PHOTOS,
    initPhotos,
    uploadMultiple,
    removePhoto,
  } = usePhotos(serviceId);

  useEffect(() => {
    if (serviceId) {
      fetchService(serviceId);
    }
  }, [serviceId, fetchService]);

  useEffect(() => {
    if (currentService?.photos) {
      initPhotos(currentService.photos);
    }
  }, [currentService, initPhotos]);

  const handleSubmit = async (dto: CreateServiceDto) => {
    setSaving(true);
    await update(serviceId, dto);
    setSaving(false);
    setLastChangeAt(Date.now());
  };

  const handleSignatureSave = async (dataUrl: string, nombreReceptor: string) => {
    try {
      await updateService(serviceId, { firmaUrl: dataUrl, firmaNombreReceptor: nombreReceptor });
      setSignatureSaved(true);
      setLastChangeAt(Date.now());
    } catch (err) {
      console.error('Error saving signature:', err);
    }
  };

  const handleUpload = async (files: File[], categoria: PhotoCategory) => {
    await uploadMultiple(files, categoria);
    setLastChangeAt(Date.now());
  };

  const handleDelete = async (photoId: string) => {
    await removePhoto(photoId);
    setLastChangeAt(Date.now());
  };

  if (loading && !currentService) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Editar Servicio</h1>
            {currentService && (
              <p className="text-gray-500 text-sm">
                OT: {currentService.ordenTrabajo} | {currentService.razonSocial}
              </p>
            )}
          </div>
        </div>

        {/* Service Form */}
        <ServiceForm
          initialData={currentService || undefined}
          onSubmit={handleSubmit}
          loading={saving}
          isEdit
        />

        {/* Photos */}
        <PhotoUploader
          serviceId={serviceId}
          photos={photos}
          uploading={uploading}
          uploadProgress={uploadProgress}
          totalPhotos={totalPhotos}
          MAX_PHOTOS={MAX_PHOTOS}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />

        {/* Signature */}
        <SignatureCanvas
          onSave={handleSignatureSave}
          existingSignature={currentService?.firmaUrl}
          existingNombre={currentService?.firmaNombreReceptor}
        />

        {/* PDF */}
        <PdfStatus
          serviceId={serviceId}
          existingPdfs={currentService?.pdfs}
          checks={{
            hasSignature: signatureSaved || !!currentService?.firmaUrl,
            hasAfterPhotos: photos.some((p) => p.categoria === 'AFTER'),
          }}
          contentUpdatedAt={lastChangeAt ?? currentService?.updatedAt}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`/services/${serviceId}`)}>
            Ver Detalle
          </Button>
          <Button onClick={() => navigate('/')}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    </Layout>
  );
}

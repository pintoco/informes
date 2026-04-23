import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export function CreateServicePage() {
  const navigate = useNavigate();
  const { create, loading } = useServices();
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);
  const {
    photos,
    uploading,
    uploadProgress,
    totalPhotos,
    MAX_PHOTOS,
    uploadMultiple,
    removePhoto,
  } = usePhotos(createdServiceId || '');

  const handleSubmit = async (dto: CreateServiceDto) => {
    const service = await create(dto);
    if (service) {
      setCreatedServiceId(service.id);
    }
  };

  const handleSignatureSave = async (dataUrl: string, nombreReceptor: string) => {
    if (!createdServiceId) return;
    try {
      await updateService(createdServiceId, { firmaUrl: dataUrl, firmaNombreReceptor: nombreReceptor });
    } catch (err) {
      console.error('Error saving signature:', err);
    }
  };

  const handleUpload = async (files: File[], categoria: PhotoCategory) => {
    await uploadMultiple(files, categoria);
  };

  const handleDelete = async (photoId: string) => {
    await removePhoto(photoId);
  };

  const handleFinish = () => {
    if (createdServiceId) {
      navigate(`/services/${createdServiceId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo Servicio Técnico</h1>
            <p className="text-gray-500 text-sm">
              {createdServiceId
                ? 'Servicio creado. Agrega fotos y firma.'
                : 'Completa los datos del servicio técnico'}
            </p>
          </div>
        </div>

        {/* Step 1: Service Form */}
        {!createdServiceId ? (
          <ServiceForm onSubmit={handleSubmit} loading={loading} />
        ) : (
          <div className="space-y-6">
            {/* Step 2: Photos */}
            <PhotoUploader
              serviceId={createdServiceId}
              photos={photos}
              uploading={uploading}
              uploadProgress={uploadProgress}
              totalPhotos={totalPhotos}
              MAX_PHOTOS={MAX_PHOTOS}
              onUpload={handleUpload}
              onDelete={handleDelete}
            />

            {/* Step 3: Signature */}
            <SignatureCanvas onSave={handleSignatureSave} />

            {/* Step 4: PDF */}
            <PdfStatus serviceId={createdServiceId} />

            {/* Finish button */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleFinish}>
                Ver Detalle
              </Button>
              <Button onClick={() => navigate('/')}>
                Volver al Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

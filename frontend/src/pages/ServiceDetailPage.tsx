import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, MapPin, Phone, Mail, Calendar, Clock, User, PenSquare, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cloneService } from '@/api/services';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layout } from '@/components/Layout';
import { PdfStatus } from '@/components/PdfStatus';
import { useServices } from '@/hooks/useServices';
import { MaintenanceType, PhotoCategory } from '@/types';

const maintenanceLabels: Record<MaintenanceType, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  INSTALLATION: 'Instalación',
  OTHER: 'Otro',
};

const maintenanceBadgeVariant: Record<MaintenanceType, 'info' | 'warning' | 'success' | 'outline'> = {
  PREVENTIVE: 'info',
  CORRECTIVE: 'warning',
  INSTALLATION: 'success',
  OTHER: 'outline',
};

interface LightboxState {
  src: string;
  name: string;
}

interface PhotoGalleryProps {
  titulo: string;
  photos: Array<{ id: string; url: string; originalName: string }>;
  onOpenLightbox: (src: string, name: string) => void;
}

function PhotoGallery({ titulo, photos, onOpenLightbox }: PhotoGalleryProps) {
  if (photos.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700">{titulo}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => onOpenLightbox(photo.url, photo.originalName)}
            className="block rounded-lg overflow-hidden border border-gray-200 aspect-square hover:opacity-90 transition-opacity cursor-zoom-in w-full"
          >
            <img
              src={photo.url}
              alt={photo.originalName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function Lightbox({ src, name, onClose }: LightboxState & { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
      >
        <X className="h-8 w-8" />
      </button>
      <div className="max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={name}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <p className="text-white/70 text-center text-sm mt-3 truncate">{name}</p>
      </div>
    </div>
  );
}

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentService, loading, fetchService } = useServices();
  const [cloning, setCloning] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const handleClone = async () => {
    if (!id) return;
    setCloning(true);
    try {
      const cloned = await cloneService(id);
      toast.success(`Servicio clonado: ${cloned.ordenTrabajo}`);
      navigate(`/services/${cloned.id}`);
    } catch {
      toast.error('Error al clonar el servicio');
    } finally {
      setCloning(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchService(id);
    }
  }, [id, fetchService]);

  if (loading && !currentService) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!currentService) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Servicio no encontrado</p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Volver al Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const beforePhotos = currentService.photos.filter((p) => p.categoria === ('BEFORE' as PhotoCategory));
  const afterPhotos = currentService.photos.filter((p) => p.categoria === ('AFTER' as PhotoCategory));

  return (
    <Layout>
      {lightbox && <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentService.razonSocial}
              </h1>
              <p className="text-gray-500 text-sm">OT: {currentService.ordenTrabajo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClone} disabled={cloning}>
              <PenSquare className="h-4 w-4 mr-2" />
              {cloning ? 'Clonando...' : 'Clonar'}
            </Button>
            <Button onClick={() => navigate(`/services/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Información del Servicio</CardTitle>
                  <Badge variant={maintenanceBadgeVariant[currentService.tipoMantenimiento]}>
                    {maintenanceLabels[currentService.tipoMantenimiento]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Ubicación</p>
                      <p className="text-sm font-medium">{currentService.ubicacion}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Fecha</p>
                      <p className="text-sm font-medium">
                        {format(new Date(currentService.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Hora de Inicio</p>
                      <p className="text-sm font-medium">{currentService.horaInicio}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Contacto Terreno</p>
                      <p className="text-sm font-medium">{currentService.contactoTerreno}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Technician */}
            <Card>
              <CardHeader>
                <CardTitle>Datos del Técnico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Responsable</p>
                    <p className="text-sm font-medium">{currentService.responsable}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Nombre del Técnico</p>
                    <p className="text-sm font-medium">{currentService.nombreTecnico}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Teléfono</p>
                      <p className="text-sm font-medium">{currentService.fono}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-medium">{currentService.email}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Technical Comments */}
            {(currentService.comentarioNvr ||
              currentService.comentarioCamaras ||
              currentService.observaciones) && (
              <Card>
                <CardHeader>
                  <CardTitle>Comentarios Técnicos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentService.comentarioNvr && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        NVR
                      </p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">
                        {currentService.comentarioNvr}
                      </p>
                    </div>
                  )}
                  {currentService.comentarioCamaras && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Cámaras
                      </p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">
                        {currentService.comentarioCamaras}
                      </p>
                    </div>
                  )}
                  {currentService.observaciones && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Observaciones
                      </p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">
                        {currentService.observaciones}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Photos */}
            {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Fotografías ({currentService.photos.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <PhotoGallery titulo="Antes del servicio" photos={beforePhotos} onOpenLightbox={(src, name) => setLightbox({ src, name })} />
                  <PhotoGallery titulo="Después del servicio" photos={afterPhotos} onOpenLightbox={(src, name) => setLightbox({ src, name })} />
                </CardContent>
              </Card>
            )}

            {/* Signature */}
            {currentService.firmaUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Firma del Receptor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentService.firmaNombreReceptor && (
                    <div>
                      <p className="text-xs text-gray-500">Nombre del receptor</p>
                      <p className="text-sm font-medium">{currentService.firmaNombreReceptor}</p>
                    </div>
                  )}
                  <div className="border rounded-lg p-4 bg-gray-50 inline-block">
                    <img
                      src={currentService.firmaUrl}
                      alt="Firma del receptor"
                      className="max-h-32 object-contain"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right sidebar: PDF */}
          <div>
            <PdfStatus serviceId={id!} existingPdfs={currentService.pdfs} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

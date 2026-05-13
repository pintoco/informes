import React, { useRef, useState, useEffect } from 'react';
import { Upload, Trash2, Image, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PhotoCategory, ServicePhoto } from '@/types';

interface PhotoUploaderProps {
  serviceId: string;
  photos: ServicePhoto[];
  uploading: boolean;
  uploadProgress: Record<string, number>;
  totalPhotos: number;
  MAX_PHOTOS: number;
  onUpload: (files: File[], categoria: PhotoCategory) => Promise<void>;
  onDelete: (photoId: string) => Promise<void>;
}

interface PhotoGridProps {
  photos: ServicePhoto[];
  categoria: PhotoCategory;
  onDelete: (photoId: string) => Promise<void>;
  onUpload: (files: File[], categoria: PhotoCategory) => Promise<void>;
  uploading: boolean;
  uploadProgress: Record<string, number>;
  remaining: number;
}

interface LightboxState { src: string; name: string }

function Lightbox({ src, name, onClose }: LightboxState & { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
        <X className="h-8 w-8" />
      </button>
      <div className="max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={name} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
        <p className="text-white/70 text-center text-sm mt-3 truncate">{name}</p>
      </div>
    </div>
  );
}

function PhotoGrid({
  photos,
  categoria,
  onDelete,
  onUpload,
  uploading,
  uploadProgress,
  remaining,
}: PhotoGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await onUpload(Array.from(files), categoria);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const progressValues = Object.values(uploadProgress);
  const activeUploads = progressValues.length;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          remaining > 0 && !uploading
            ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            : 'border-gray-200 bg-gray-50 cursor-not-allowed'
        }`}
        onClick={() => remaining > 0 && !uploading && fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          {uploading ? (
            <span>Subiendo {activeUploads} foto(s)...</span>
          ) : remaining > 0 ? (
            <>
              <span className="font-medium text-blue-600">Haz click para seleccionar</span>
              {' '}o arrastra fotos aquí
            </>
          ) : (
            <span className="text-red-500">Límite de fotos alcanzado</span>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP (se comprimen automáticamente)</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={remaining <= 0 || uploading}
        />
        {/* Input de cámara: abre directamente la cámara trasera en móvil */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={remaining <= 0 || uploading}
        />
      </div>

      {/* Botón de cámara para móvil */}
      {remaining > 0 && !uploading && (
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg transition-colors bg-blue-50 hover:bg-blue-100 md:hidden"
        >
          📷 Usar cámara
        </button>
      )}

      {/* Progress bars */}
      {activeUploads > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="truncate max-w-48">{filename}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />}

      {/* Photos grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square cursor-zoom-in"
              onClick={() => setLightbox({ src: photo.url, name: photo.originalName })}>
              <img
                src={photo.url}
                alt={photo.originalName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                {photo.originalName}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Image className="h-12 w-12 mb-2" />
          <p className="text-sm">No hay fotos {categoria === 'BEFORE' ? 'antes' : 'después'}</p>
        </div>
      )}
    </div>
  );
}

export function PhotoUploader({
  serviceId: _serviceId,
  photos,
  uploading,
  uploadProgress,
  totalPhotos,
  MAX_PHOTOS,
  onUpload,
  onDelete,
}: PhotoUploaderProps) {
  const beforePhotos = photos.filter((p) => p.categoria === 'BEFORE');
  const afterPhotos = photos.filter((p) => p.categoria === 'AFTER');
  const remaining = MAX_PHOTOS - totalPhotos;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold text-gray-900">Fotografías</h3>
        <Badge variant={remaining > 0 ? 'info' : 'warning'}>
          {totalPhotos}/{MAX_PHOTOS} fotos
        </Badge>
      </div>

      <Tabs defaultValue="before">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="before">
            Antes ({beforePhotos.length})
          </TabsTrigger>
          <TabsTrigger value="after">
            Después ({afterPhotos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="before" className="mt-4">
          <PhotoGrid
            photos={beforePhotos}
            categoria="BEFORE"
            onDelete={onDelete}
            onUpload={onUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
            remaining={remaining}
          />
        </TabsContent>

        <TabsContent value="after" className="mt-4">
          <PhotoGrid
            photos={afterPhotos}
            categoria="AFTER"
            onDelete={onDelete}
            onUpload={onUpload}
            uploading={uploading}
            uploadProgress={uploadProgress}
            remaining={remaining}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

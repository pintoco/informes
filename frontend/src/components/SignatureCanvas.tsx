import React, { useRef, useState } from 'react';
import ReactSignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RotateCcw, Save, PenLine } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (dataUrl: string, nombreReceptor: string) => void;
  existingSignature?: string | null;
  existingNombre?: string | null;
}

export function SignatureCanvas({ onSave, existingSignature, existingNombre }: SignatureCanvasProps) {
  const sigRef = useRef<ReactSignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saved, setSaved] = useState(false);
  const [nombreReceptor, setNombreReceptor] = useState(existingNombre || '');
  const [currentSignature, setCurrentSignature] = useState<string | null>(
    existingSignature || null
  );

  const handleClear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
    setSaved(false);
  };

  const handleSave = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL('image/png');
      setCurrentSignature(dataUrl);
      onSave(dataUrl, nombreReceptor);
      setSaved(true);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
    setSaved(false);
  };

  const handleCambiar = () => {
    setCurrentSignature(null);
    setSaved(false);
    setIsEmpty(true);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <PenLine className="h-5 w-5" />
          Firma de Recepción
        </h3>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Firma guardada</span>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nombreReceptor">Nombre de quien recibe</Label>
        <Input
          id="nombreReceptor"
          placeholder="Nombre completo del receptor"
          value={nombreReceptor}
          onChange={(e) => setNombreReceptor(e.target.value)}
        />
      </div>

      {currentSignature && !saved ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Firma actual:</p>
          <div className="border rounded-lg overflow-hidden bg-white p-2">
            <img
              src={currentSignature}
              alt="Firma guardada"
              className="max-h-32 object-contain mx-auto"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCambiar}
          >
            Cambiar firma
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Firme en el recuadro de abajo usando el mouse o touchscreen:
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
            <ReactSignatureCanvas
              ref={sigRef}
              canvasProps={{
                width: 500,
                height: 200,
                className: 'w-full signature-canvas',
                style: { width: '100%', height: '200px' },
              }}
              backgroundColor="rgba(0,0,0,0)"
              onBegin={handleBegin}
            />
          </div>

          <div className="flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isEmpty}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isEmpty}
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar Firma
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Eye, FileText, RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { requestPdf, getPdfStatus, downloadPdf } from '@/api/pdfs';
import { ServicePdf, PdfStatus as IPdfStatus } from '@/types';

interface PdfStatusProps {
  serviceId: string;
  existingPdfs?: ServicePdf[];
  // Para avisar antes de generar un informe incompleto
  checks?: { hasSignature: boolean; hasAfterPhotos: boolean };
  // Última modificación del servicio (datos, fotos o firma): si es posterior al
  // último PDF, ese PDF está desactualizado
  contentUpdatedAt?: string | number | null;
}

const statusConfig: Record<
  IPdfStatus,
  { label: string; variant: 'warning' | 'info' | 'success' | 'error'; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: { label: 'Pendiente', variant: 'warning', icon: RefreshCw },
  PROCESSING: { label: 'Procesando', variant: 'info', icon: RefreshCw },
  READY: { label: 'Listo', variant: 'success', icon: FileText },
  ERROR: { label: 'Error', variant: 'error', icon: AlertCircle },
};

// 60 intentos × 5s = 5 minutos máximo de polling
const MAX_POLL_ATTEMPTS = 60;

export function PdfStatus({ serviceId, existingPdfs = [], checks, contentUpdatedAt }: PdfStatusProps) {
  const [pdfs, setPdfs] = useState<ServicePdf[]>(existingPdfs);
  const [missingWarning, setMissingWarning] = useState<string[] | null>(null);

  // existingPdfs llega después de cargar el servicio (página de edición/detalle)
  useEffect(() => {
    if (existingPdfs.length > 0) setPdfs(existingPdfs);
  }, [existingPdfs]);
  const [requesting, setRequesting] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollAttemptsRef = useRef(0);

  const latestPdf = pdfs.length > 0 ? pdfs[pdfs.length - 1] : null;
  const isStale =
    latestPdf?.status === 'READY' &&
    !!contentUpdatedAt &&
    new Date(contentUpdatedAt).getTime() > new Date(latestPdf.createdAt).getTime();

  const notifyPdfReady = useCallback((version: number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PDF listo', {
        body: `El informe PDF v${version} está listo para descargar.`,
        icon: '/favicon.png',
      });
    }
  }, []);

  const pollStatus = useCallback(
    async (pdfId: string) => {
      try {
        const updated = await getPdfStatus(serviceId, pdfId);
        setPdfs((prev) => prev.map((p) => (p.id === pdfId ? updated : p)));
        if (updated.status === 'READY' || updated.status === 'ERROR') {
          setPollingId(null);
          pollAttemptsRef.current = 0;
          if (updated.status === 'READY') notifyPdfReady(updated.version);
        }
      } catch {
        // Silently fail on polling errors
      }
    },
    [serviceId, notifyPdfReady],
  );

  useEffect(() => {
    if (!pollingId) return;
    pollAttemptsRef.current = 0;
    setPollTimedOut(false);
  }, [pollingId]);

  useEffect(() => {
    if (!pollingId) return;

    const interval = setInterval(() => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        setPollingId(null);
        setPollTimedOut(true);
        return;
      }
      pollStatus(pollingId);
    }, 5000);

    return () => clearInterval(interval);
  }, [pollingId, pollStatus]);

  useEffect(() => {
    if (latestPdf && (latestPdf.status === 'PENDING' || latestPdf.status === 'PROCESSING')) {
      setPollingId(latestPdf.id);
    }
  }, [latestPdf]);

  // Antes de generar: avisar si al informe le falta la firma o las fotos "después"
  const handleGenerateClick = () => {
    const missing: string[] = [];
    if (checks && !checks.hasSignature) missing.push('la firma del receptor');
    if (checks && !checks.hasAfterPhotos) missing.push('fotos "después del servicio"');
    if (missing.length > 0) {
      setMissingWarning(missing);
      return;
    }
    handleRequestPdf();
  };

  const handleRequestPdf = async () => {
    setMissingWarning(null);
    setRequesting(true);
    setPollTimedOut(false);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    try {
      const pdf = await requestPdf(serviceId);
      setPdfs((prev) => [...prev, pdf]);
      setPollingId(pdf.id);
    } catch {
      // Error handled by API layer
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = () => {
    if (latestPdf?.url) downloadPdf(latestPdf.url);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Informe PDF
        </h3>
      </div>

      {latestPdf ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {(() => {
                  const config = statusConfig[latestPdf.status];
                  const Icon = config.icon;
                  return (
                    <>
                      <Badge variant={config.variant}>
                        <Icon
                          className={`h-3 w-3 mr-1 ${
                            latestPdf.status === 'PROCESSING' || latestPdf.status === 'PENDING'
                              ? 'animate-spin'
                              : ''
                          }`}
                        />
                        {config.label}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(latestPdf.createdAt).toLocaleString('es-CL', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </>
                  );
                })()}
              </div>
              {(latestPdf.status === 'PENDING' || latestPdf.status === 'PROCESSING') && !pollTimedOut && (
                <p className="text-xs text-gray-400">Generando PDF... se actualizará automáticamente</p>
              )}
              {pollTimedOut && (
                <p className="text-xs text-orange-500">
                  La generación está tardando más de lo esperado. Recarga la página o reintenta.
                </p>
              )}
              {latestPdf.status === 'ERROR' && latestPdf.errorMessage && (
                <p className="text-xs text-red-500">{latestPdf.errorMessage}</p>
              )}
              {isStale && (
                <p className="flex items-center gap-1 text-xs text-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  El servicio cambió después de generar este PDF. Regenéralo para incluir los cambios.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {latestPdf.status === 'READY' && (
                <Button size="sm" onClick={handleDownload}>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver PDF
                </Button>
              )}
              <Button
                size="sm"
                variant={isStale ? 'default' : 'outline'}
                onClick={handleGenerateClick}
                disabled={
                  requesting ||
                  (!pollTimedOut &&
                    (latestPdf.status === 'PENDING' || latestPdf.status === 'PROCESSING'))
                }
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${requesting ? 'animate-spin' : ''}`} />
                {latestPdf.status === 'ERROR' || pollTimedOut ? 'Reintentar' : 'Regenerar'}
              </Button>
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-6 space-y-3">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No se ha generado ningún informe PDF para este servicio.</p>
          <Button onClick={handleGenerateClick} disabled={requesting}>
            <FileText className="h-4 w-4 mr-2" />
            {requesting ? 'Solicitando...' : 'Generar Informe PDF'}
          </Button>
        </div>
      )}

      <Dialog open={!!missingWarning} onOpenChange={() => setMissingWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Al informe le falta información</DialogTitle>
            <DialogDescription>
              Este servicio no tiene {missingWarning?.join(' ni ')}. ¿Generar el PDF de todas formas?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingWarning(null)}>
              Volver y completar
            </Button>
            <Button onClick={handleRequestPdf}>Generar igual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

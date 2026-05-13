import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Eye, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requestPdf, getPdfStatus, downloadPdf } from '@/api/pdfs';
import { ServicePdf, PdfStatus as IPdfStatus } from '@/types';

interface PdfStatusProps {
  serviceId: string;
  existingPdfs?: ServicePdf[];
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

export function PdfStatus({ serviceId, existingPdfs = [] }: PdfStatusProps) {
  const [pdfs, setPdfs] = useState<ServicePdf[]>(existingPdfs);
  const [requesting, setRequesting] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollAttemptsRef = useRef(0);

  const latestPdf = pdfs.length > 0 ? pdfs[pdfs.length - 1] : null;

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

  const handleRequestPdf = async () => {
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
                      <span className="text-sm text-gray-500">Versión {latestPdf.version}</span>
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
                variant="outline"
                onClick={handleRequestPdf}
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

          {/* History */}
          {pdfs.length > 1 && (
            <details className="text-sm">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                Ver historial ({pdfs.length} versiones)
              </summary>
              <div className="mt-2 space-y-1 pl-4">
                {[...pdfs].reverse().map((pdf) => {
                  const config = statusConfig[pdf.status];
                  return (
                    <div key={pdf.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                      <span>v{pdf.version}</span>
                      <span>{new Date(pdf.createdAt).toLocaleString('es-CL')}</span>
                      {pdf.status === 'READY' && pdf.url && (
                        <button onClick={() => downloadPdf(pdf.url!)} className="text-blue-600 hover:underline">
                          Ver PDF
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="text-center py-6 space-y-3">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No se ha generado ningún informe PDF para este servicio.</p>
          <Button onClick={handleRequestPdf} disabled={requesting}>
            <FileText className="h-4 w-4 mr-2" />
            {requesting ? 'Solicitando...' : 'Generar Informe PDF'}
          </Button>
        </div>
      )}
    </div>
  );
}

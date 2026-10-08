import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle, MapPin, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { parseServiceDate } from '@/lib/utils';
import { StatsResponse } from '@/types';

interface DashboardInsightsProps {
  stats: StatsResponse;
  // Filtra el listado por cliente + ubicación (puntos recurrentes)
  onFilterPoint: (razonSocial: string, ubicacion: string) => void;
}

const issueVariant: Record<string, 'warning' | 'error' | 'info'> = {
  'Sin firma': 'warning',
  'Sin fotos "después"': 'warning',
  'Sin PDF': 'error',
  'PDF desactualizado': 'info',
};

function Panel({
  title,
  icon: Icon,
  iconClass,
  children,
}: {
  title: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function DashboardInsights({ stats, onFilterPoint }: DashboardInsightsProps) {
  const navigate = useNavigate();
  const { attention, recurringPoints, thisMonthByClient } = stats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Este mes, por cliente */}
      <Panel title={`Este mes · ${stats.thisMonth} servicios`} icon={BarChart3} iconClass="text-indigo-500">
        {thisMonthByClient.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay servicios este mes.</p>
        ) : (
          <ul className="space-y-2">
            {thisMonthByClient.map((c) => (
              <li key={c.razonSocial} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-700 truncate" title={c.razonSocial}>{c.razonSocial}</span>
                <span className="font-semibold text-gray-900">{c.count}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto pt-3 text-xs text-gray-400">{stats.total} servicios en total</p>
      </Panel>

      {/* Informes incompletos */}
      <Panel
        title={`Para revisar · últimos ${attention.windowDays} días`}
        icon={attention.totalItems > 0 ? AlertTriangle : CheckCircle}
        iconClass={attention.totalItems > 0 ? 'text-orange-500' : 'text-green-500'}
      >
        {attention.totalItems === 0 ? (
          <p className="text-sm text-gray-500">Todos los informes recientes están completos.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 mb-3">
              {attention.sinFirma > 0 && <Badge variant="warning">{attention.sinFirma} sin firma</Badge>}
              {attention.sinFotosDespues > 0 && (
                <Badge variant="warning">{attention.sinFotosDespues} sin fotos "después"</Badge>
              )}
              {attention.sinPdf > 0 && <Badge variant="error">{attention.sinPdf} sin PDF</Badge>}
              {attention.pdfDesactualizado > 0 && (
                <Badge variant="info">{attention.pdfDesactualizado} PDF desactualizado</Badge>
              )}
            </div>
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {attention.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(`/services/${item.id}`)}
                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-gray-900">{item.ordenTrabajo}</span>
                      <span className="text-xs text-gray-400">
                        {format(parseServiceDate(item.fecha), 'dd/MM', { locale: es })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{item.ubicacion}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.issues.map((issue) => (
                        <Badge key={issue} variant={issueVariant[issue] ?? 'outline'} className="text-[10px] px-1.5 py-0">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {attention.totalItems > attention.items.length && (
              <p className="pt-2 text-xs text-gray-400">
                y {attention.totalItems - attention.items.length} más…
              </p>
            )}
          </>
        )}
      </Panel>

      {/* Puntos con fallas recurrentes */}
      <Panel
        title={`Fallas recurrentes · ${recurringPoints.windowDays} días`}
        icon={Repeat}
        iconClass="text-red-500"
      >
        {recurringPoints.items.length === 0 ? (
          <p className="text-sm text-gray-500">Ningún punto con 3 o más correctivos.</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {recurringPoints.items.map((p) => (
              <li key={`${p.razonSocial}|${p.ubicacion}`}>
                <button
                  onClick={() => onFilterPoint(p.razonSocial, p.ubicacion)}
                  className="w-full text-left rounded-md px-2 py-1.5 hover:bg-gray-50"
                  title="Ver todas las visitas a este punto"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1 font-medium text-gray-900 truncate">
                      <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      {p.ubicacion}
                    </span>
                    <Badge variant="error">{p.correctivos} correctivos</Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {p.razonSocial} · última {format(parseServiceDate(p.ultima), 'dd/MM', { locale: es })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

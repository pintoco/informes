import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Archive, CheckCircle, FileText, RefreshCw, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listCompanies } from '@/api/companies';
import { downloadMonthlyFile, generateMissingPdfs, getMonthlyReport, getReportPeriods } from '@/api/reports';
import { parseServiceDate } from '@/lib/utils';
import { Company, MonthlyPdfState, MonthlyReport, ReportPeriod } from '@/types';

const maintenanceLabels: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  INSTALLATION: 'Instalación',
  OTHER: 'Otro',
};

const pdfBadge: Record<MonthlyPdfState, { label: string; variant: 'success' | 'info' | 'warning' | 'error' }> = {
  READY: { label: 'Listo', variant: 'success' },
  STALE: { label: 'Desactualizado', variant: 'warning' },
  IN_PROGRESS: { label: 'Generando…', variant: 'info' },
  MISSING: { label: 'Sin PDF', variant: 'error' },
};

const formatPeriod = (p: ReportPeriod) =>
  `${format(parseServiceDate(p.from), "d MMM yyyy", { locale: es })} – ${format(parseServiceDate(p.to), "d MMM yyyy", { locale: es })}`;

// Informe mensual por institución: cada una tiene su período (ej. del 13 al 12).
export function MonthlyReportPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [periods, setPeriods] = useState<ReportPeriod[]>([]);
  const [from, setFrom] = useState('');
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'zip' | 'generate' | null>(null);

  useEffect(() => {
    listCompanies()
      .then((list) => {
        setCompanies(list);
        if (list.length > 0) setCompanyId(list[0].id);
      })
      .catch(() => toast.error('No se pudieron cargar las instituciones'));
  }, []);

  // Al cambiar de institución: sus períodos, seleccionando el más reciente
  useEffect(() => {
    if (!companyId) return;
    setReport(null);
    getReportPeriods(companyId)
      .then(({ periods: list }) => {
        setPeriods(list);
        setFrom(list[0]?.from ?? '');
      })
      .catch(() => toast.error('No se pudieron calcular los períodos'));
  }, [companyId]);

  const loadReport = useCallback(async () => {
    if (!companyId || !from) return;
    setLoading(true);
    try {
      setReport(await getMonthlyReport(companyId, from));
    } catch {
      toast.error('No se pudo cargar el informe');
    } finally {
      setLoading(false);
    }
  }, [companyId, from]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Mientras haya PDFs generándose, refrescar el estado cada 5 s
  const inProgress = report?.services.some((s) => s.pdf === 'IN_PROGRESS') ?? false;
  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(() => {
      if (companyId && from) getMonthlyReport(companyId, from).then(setReport).catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [inProgress, companyId, from]);

  const pendingCount = report?.services.filter((s) => s.pdf === 'MISSING' || s.pdf === 'STALE').length ?? 0;
  const readyCount = report?.services.filter((s) => s.pdf === 'READY' || s.pdf === 'STALE').length ?? 0;

  const handleGenerate = async () => {
    setBusy('generate');
    try {
      const { queued } = await generateMissingPdfs(companyId, from);
      toast.success(`${queued} PDF${queued !== 1 ? 's' : ''} en generación`);
      await loadReport();
    } catch {
      toast.error('No se pudieron generar los PDFs');
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (kind: 'pdf' | 'zip') => {
    setBusy(kind);
    try {
      await downloadMonthlyFile(kind, companyId, from);
    } catch {
      toast.error('No se pudo descargar el informe');
    } finally {
      setBusy(null);
    }
  };

  const selectedCompany = companies.find((c) => c.id === companyId);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informe mensual</h1>
          <p className="text-gray-500 text-sm mt-1">
            Servicios de cada institución según su período de facturación.
          </p>
        </div>

        {/* Selección */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto] gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="company">Institución</Label>
            <select
              id="company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="period">Período</Label>
            <select
              id="period"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {periods.map((p, i) => (
                <option key={p.from} value={p.from}>
                  {formatPeriod(p)}{i === 0 ? ' (actual)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/companies')} title="Cambiar el día de inicio del período">
            <Settings className="h-4 w-4 mr-1" />
            {selectedCompany && selectedCompany.periodStartDay > 1
              ? `Corte: día ${selectedCompany.periodStartDay}`
              : 'Corte: mes calendario'}
          </Button>
        </div>

        {loading && !report ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : report && (
          <>
            {/* Totales y acciones */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                  <p className="text-2xl font-bold text-gray-900">{report.totals.total}</p>
                  <p className="text-xs text-gray-600">servicios</p>
                </div>
                {Object.entries(report.totals.byType).map(([tipo, n]) => (
                  <div key={tipo} className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <p className="text-2xl font-bold text-gray-900">{n}</p>
                    <p className="text-xs text-gray-600">{maintenanceLabels[tipo] ?? tipo}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleDownload('zip')} disabled={!!busy || readyCount === 0}>
                  <Archive className="h-4 w-4 mr-2" />
                  {busy === 'zip' ? 'Descargando…' : 'ZIP con PDFs'}
                </Button>
                <Button onClick={() => handleDownload('pdf')} disabled={!!busy || report.totals.total === 0}>
                  <FileText className="h-4 w-4 mr-2" />
                  {busy === 'pdf' ? 'Armando PDF…' : 'PDF consolidado'}
                </Button>
              </div>
            </div>

            {/* PDFs faltantes */}
            {pendingCount > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                <p className="flex items-center gap-2 text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {pendingCount} servicio{pendingCount !== 1 ? 's' : ''} sin PDF o con el PDF desactualizado.
                  No se incluirán (o irán en su versión anterior) hasta generarlos.
                </p>
                <Button size="sm" onClick={handleGenerate} disabled={!!busy}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${busy === 'generate' ? 'animate-spin' : ''}`} />
                  Generar {pendingCount} PDF{pendingCount !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
            {inProgress && (
              <p className="flex items-center gap-2 text-sm text-blue-700">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generando PDFs… la tabla se actualiza sola.
              </p>
            )}
            {!inProgress && pendingCount === 0 && report.totals.total > 0 && (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" />
                Todos los informes del período están listos.
              </p>
            )}

            {/* Detalle */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>OT</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="min-w-[260px]">Trabajo realizado</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Fotos</TableHead>
                    <TableHead>PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.services.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                        No hay servicios en este período
                      </TableCell>
                    </TableRow>
                  ) : report.services.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/services/${s.id}`)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">{s.ordenTrabajo}</TableCell>
                      <TableCell className="whitespace-nowrap text-gray-600">
                        {format(parseServiceDate(s.fecha), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-600">{s.ubicacion}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{maintenanceLabels[s.tipoMantenimiento]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{s.trabajo || '—'}</TableCell>
                      <TableCell>
                        {s.firma
                          ? <Badge variant="success">Sí</Badge>
                          : <Badge variant="warning">No</Badge>}
                      </TableCell>
                      <TableCell className="text-gray-600 whitespace-nowrap">
                        {s.fotos}{s.fotosDespues === 0 && s.fotos > 0 && (
                          <span className="text-xs text-orange-600 ml-1" title='Sin fotos "después"'>⚠</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pdfBadge[s.pdf].variant}>{pdfBadge[s.pdf].label}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

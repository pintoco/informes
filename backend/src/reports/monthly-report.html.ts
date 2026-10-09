import { esc, LOGO_BASE64 } from '../pdfs/pdf-worker/templates/report.html';

export interface MonthlyReportRow {
  ordenTrabajo: string;
  fecha: Date;
  ubicacion: string;
  tipoMantenimiento: string;
  trabajo: string;
  firma: boolean;
  fotos: number;
  adjunto: boolean; // el PDF del servicio va incluido en el consolidado
}

export interface MonthlyReportData {
  institucion: string;
  desde: Date;
  hasta: Date;
  emitidoPor: string;
  rows: MonthlyReportRow[];
}

const TIPO_LABEL: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  INSTALLATION: 'Instalación',
  OTHER: 'Otro',
};

// Fechas de servicio: medianoche UTC del día elegido
const fmt = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

/** Portada + resumen del informe mensual (primeras páginas del PDF consolidado). */
export function generateMonthlyReportHtml(data: MonthlyReportData): string {
  const totals = Object.keys(TIPO_LABEL)
    .map((tipo) => ({ tipo, n: data.rows.filter((r) => r.tipoMantenimiento === tipo).length }))
    .filter((t) => t.n > 0);
  const sinAdjunto = data.rows.filter((r) => !r.adjunto);
  const emitido = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe mensual - ${esc(data.institucion)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
  body { color: #1a1a1a; font-size: 10pt; line-height: 1.45; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #f97316; padding-bottom: 12px; margin-bottom: 18px; }
  .header img { height: 54px; }
  .header .meta { text-align: right; font-size: 9pt; color: #475569; }
  h1 { font-size: 18pt; color: #0f172a; margin-bottom: 4px; }
  h2 { font-size: 12pt; color: #0f172a; margin: 18px 0 8px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
  .info .label { font-size: 8pt; text-transform: uppercase; color: #64748b; letter-spacing: .04em; }
  .info .value { font-weight: bold; }
  .totals { display: flex; gap: 10px; flex-wrap: wrap; }
  .total { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; min-width: 110px; }
  .total .n { font-size: 16pt; font-weight: bold; color: #0f172a; }
  .total .t { font-size: 8.5pt; color: #64748b; }
  .total.main { background: #fff7ed; border-color: #fdba74; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 6px 5px; font-weight: bold; }
  td { border-bottom: 1px solid #e2e8f0; padding: 5px; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #f8fafc; }
  .nowrap { white-space: nowrap; }
  .ok { color: #15803d; font-weight: bold; }
  .no { color: #b45309; font-weight: bold; }
  .note { margin-top: 14px; font-size: 9pt; color: #475569; }
  .warn { margin-top: 10px; font-size: 9pt; color: #b45309; }
</style>
</head>
<body>
  <div class="header">
    ${LOGO_BASE64 ? `<img src="${LOGO_BASE64}" alt="Elemental" />` : '<strong>Elemental Pro</strong>'}
    <div class="meta">Emitido el ${emitido}<br/>por ${esc(data.emitidoPor)}</div>
  </div>

  <h1>Informe Mensual de Servicios</h1>
  <div class="info">
    <div><div class="label">Institución</div><div class="value">${esc(data.institucion)}</div></div>
    <div><div class="label">Período</div><div class="value">${fmt(data.desde)} al ${fmt(data.hasta)}</div></div>
  </div>

  <h2>Resumen</h2>
  <div class="totals">
    <div class="total main"><div class="n">${data.rows.length}</div><div class="t">Servicios en el período</div></div>
    ${totals.map((t) => `<div class="total"><div class="n">${t.n}</div><div class="t">${TIPO_LABEL[t.tipo]}</div></div>`).join('')}
  </div>

  <h2>Detalle de servicios</h2>
  ${data.rows.length === 0 ? '<p>No hay servicios registrados en este período.</p>' : `
  <table>
    <thead>
      <tr>
        <th>OT</th><th>Fecha</th><th>Ubicación</th><th>Tipo</th><th>Trabajo realizado</th><th>Firma</th><th>Fotos</th>
      </tr>
    </thead>
    <tbody>
      ${data.rows.map((r) => `
      <tr>
        <td class="nowrap"><strong>${esc(r.ordenTrabajo)}</strong></td>
        <td class="nowrap">${fmt(r.fecha)}</td>
        <td>${esc(r.ubicacion)}</td>
        <td class="nowrap">${TIPO_LABEL[r.tipoMantenimiento] ?? esc(r.tipoMantenimiento)}</td>
        <td>${esc(r.trabajo) || '—'}</td>
        <td class="nowrap">${r.firma ? '<span class="ok">Sí</span>' : '<span class="no">No</span>'}</td>
        <td class="nowrap">${r.fotos}</td>
      </tr>`).join('')}
    </tbody>
  </table>`}

  <p class="note">A continuación se adjuntan los informes técnicos de cada servicio, ordenados por fecha.</p>
  ${sinAdjunto.length > 0 ? `<p class="warn">Sin informe adjunto: ${sinAdjunto.map((r) => esc(r.ordenTrabajo)).join(', ')}.</p>` : ''}
</body>
</html>`;
}

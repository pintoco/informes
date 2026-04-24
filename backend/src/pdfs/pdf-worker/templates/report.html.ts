import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const LOGO_BASE64 = 'data:image/png;base64,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';

interface ServiceData {
  id: string;
  razonSocial: string;
  ubicacion: string;
  contactoTerreno: string;
  ordenTrabajo: string;
  fecha: Date;
  horaInicio: string;
  responsable: string;
  nombreTecnico: string;
  fono: string;
  email: string;
  tipoMantenimiento: string;
  comentarioNvr?: string | null;
  comentarioSwitch?: string | null;
  observaciones?: string | null;
  firmaUrl?: string | null;
  firmaNombreReceptor?: string | null;
}

interface PhotoData {
  id: string;
  categoria: string;
  originalName: string;
  dataUrl: string | null;
  url: string;
}

const maintenanceTypeLabels: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  INSTALLATION: 'Instalación',
  OTHER: 'Otro',
};

export function generateReportHtml(
  service: ServiceData,
  photos: PhotoData[]
): string {
  const beforePhotos = photos.filter((p) => p.categoria === 'BEFORE');
  const afterPhotos = photos.filter((p) => p.categoria === 'AFTER');

  const fechaFormateada = format(new Date(service.fecha), "d 'de' MMMM 'de' yyyy", {
    locale: es,
  });

  const generatedAt = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  const renderPhotos = (photoList: PhotoData[], title: string) => {
    if (photoList.length === 0) return '';
    return `
      <div class="section">
        <div class="section-title">${title}</div>
        <div class="photos-grid">
          ${photoList
            .map(
              (photo) => `
            <div class="photo-item">
              ${
                photo.dataUrl
                  ? `<img src="${photo.dataUrl}" alt="" />`
                  : `<div class="photo-placeholder">Imagen no disponible</div>`
              }
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe Técnico - ${service.ordenTrabajo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Arial', 'Helvetica', sans-serif;
    }

    body {
      background: #fff;
      color: #1a1a1a;
      font-size: 11pt;
      line-height: 1.5;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 20px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      object-fit: contain;
      background: white;
      padding: 4px;
    }

    .logo-text h1 {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: 1px;
    }

    .logo-text p {
      font-size: 9pt;
      opacity: 0.85;
    }

    .header-info {
      text-align: right;
    }

    .header-info .ot {
      font-size: 16pt;
      font-weight: 700;
    }

    .header-info .fecha {
      font-size: 10pt;
      opacity: 0.9;
    }

    /* Document title */
    .doc-title {
      background: #f0f4ff;
      text-align: center;
      padding: 12px;
      border-bottom: 3px solid #1e40af;
    }

    .doc-title h2 {
      font-size: 14pt;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    /* Content */
    .content {
      padding: 20px 30px;
    }

    /* Sections */
    .section {
      margin-bottom: 20px;
    }

    .section-title {
      background: #1e40af;
      color: white;
      padding: 6px 12px;
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
      border-radius: 3px;
    }

    /* Data table */
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .data-table td {
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      font-size: 10pt;
    }

    .data-table td.label {
      background: #f8fafc;
      font-weight: 600;
      width: 30%;
      color: #475569;
    }

    .data-table td.value {
      color: #1a1a1a;
    }

    /* Badge */
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 600;
    }

    .badge-preventive { background: #dbeafe; color: #1e40af; }
    .badge-corrective { background: #fef3c7; color: #92400e; }
    .badge-installation { background: #d1fae5; color: #065f46; }
    .badge-other { background: #f1f5f9; color: #475569; }

    /* Comment box */
    .comment-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #3b82f6;
      padding: 10px 14px;
      margin-bottom: 8px;
      border-radius: 0 4px 4px 0;
      font-size: 10pt;
      line-height: 1.6;
    }

    .comment-label {
      font-size: 9pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    /* Photos grid */
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .photo-item {
      text-align: center;
    }

    .photo-item img {
      width: 100%;
      height: 160px;
      object-fit: cover;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }

    .photo-placeholder {
      width: 100%;
      height: 160px;
      background: #f1f5f9;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 9pt;
    }

    /* Signature */
    .signature-section {
      display: flex;
      gap: 20px;
      align-items: flex-end;
    }

    .signature-box {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 10px;
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .signature-box img {
      max-height: 80px;
      max-width: 100%;
      object-fit: contain;
    }

    .signature-info {
      flex: 1;
    }

    .signature-line {
      border-bottom: 1px solid #1a1a1a;
      margin-bottom: 4px;
      padding-bottom: 4px;
    }

    .signature-label {
      font-size: 9pt;
      color: #64748b;
    }

    /* Footer */
    .footer {
      background: #f8fafc;
      border-top: 2px solid #e2e8f0;
      padding: 10px 30px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
      margin-top: 20px;
    }

    /* Page break */
    .page-break {
      page-break-after: always;
    }

    @media print {
      body { background: white; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      <img class="logo-icon" src="${LOGO_BASE64}" alt="Elemental" />
      <div class="logo-text">
        <h1>ELEMENTAL PRO</h1>
        <p>Sistema de Gestión de Servicios Técnicos</p>
      </div>
    </div>
    <div class="header-info">
      <div class="ot">OT: ${service.ordenTrabajo}</div>
      <div class="fecha">${fechaFormateada}</div>
    </div>
  </div>

  <!-- Document Title -->
  <div class="doc-title">
    <h2>Informe Técnico / Hoja de Servicio</h2>
  </div>

  <!-- Content -->
  <div class="content">

    <!-- Client Info -->
    <div class="section">
      <div class="section-title">Información del Cliente</div>
      <table class="data-table">
        <tr>
          <td class="label">Razón Social</td>
          <td class="value">${service.razonSocial}</td>
          <td class="label">Orden de Trabajo</td>
          <td class="value"><strong>${service.ordenTrabajo}</strong></td>
        </tr>
        <tr>
          <td class="label">Ubicación</td>
          <td class="value" colspan="3">${service.ubicacion}</td>
        </tr>
        <tr>
          <td class="label">Contacto Terreno</td>
          <td class="value">${service.contactoTerreno}</td>
          <td class="label">Tipo de Mantención</td>
          <td class="value">
            <span class="badge badge-${service.tipoMantenimiento.toLowerCase()}">
              ${maintenanceTypeLabels[service.tipoMantenimiento] || service.tipoMantenimiento}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Service Details -->
    <div class="section">
      <div class="section-title">Datos del Servicio</div>
      <table class="data-table">
        <tr>
          <td class="label">Fecha</td>
          <td class="value">${fechaFormateada}</td>
          <td class="label">Hora de Inicio</td>
          <td class="value">${service.horaInicio}</td>
        </tr>
        <tr>
          <td class="label">Responsable</td>
          <td class="value">${service.responsable}</td>
          <td class="label">Técnico</td>
          <td class="value">${service.nombreTecnico}</td>
        </tr>
        <tr>
          <td class="label">Teléfono</td>
          <td class="value">${service.fono}</td>
          <td class="label">Email</td>
          <td class="value">${service.email}</td>
        </tr>
      </table>
    </div>

    <!-- Technical Comments -->
    ${
      service.comentarioNvr || service.comentarioSwitch || service.observaciones
        ? `
    <div class="section">
      <div class="section-title">Comentarios Técnicos</div>
      ${
        service.comentarioNvr
          ? `
      <div class="comment-box">
        <div class="comment-label">NVR</div>
        ${service.comentarioNvr}
      </div>`
          : ''
      }
      ${
        service.comentarioSwitch
          ? `
      <div class="comment-box">
        <div class="comment-label">Switch</div>
        ${service.comentarioSwitch}
      </div>`
          : ''
      }
      ${
        service.observaciones
          ? `
      <div class="comment-box">
        <div class="comment-label">Observaciones Generales</div>
        ${service.observaciones}
      </div>`
          : ''
      }
    </div>`
        : ''
    }

    <!-- Before Photos -->
    ${renderPhotos(beforePhotos, 'Fotografías - Antes del Servicio')}

    <!-- After Photos -->
    ${renderPhotos(afterPhotos, 'Fotografías - Después del Servicio')}

    <!-- Signature -->
    <div class="section">
      <div class="section-title">Firma y Conformidad</div>
      <div class="signature-section">
        <div style="flex: 1;">
          <p style="font-size: 10pt; margin-bottom: 8px; color: #475569;">
            El presente informe da cuenta del servicio técnico realizado en las
            instalaciones del cliente, conforme a los procedimientos y estándares
            de Elemental Pro.
          </p>
          <div class="signature-info">
            <div class="signature-line">
              <strong>${service.responsable}</strong>
            </div>
            <div class="signature-label">Responsable</div>
            <div class="signature-label" style="margin-top: 4px;">
              ${service.fono} | ${service.email}
            </div>
          </div>
        </div>
        <div style="flex: 1;">
          <p style="font-size: 9pt; color: #475569; margin-bottom: 4px;">Firma de Recepción:</p>
          ${
            service.firmaUrl
              ? `<div class="signature-box">
            <img src="${service.firmaUrl}" alt="Firma del receptor" />
          </div>
          <div class="signature-info" style="margin-top: 4px;">
            <div class="signature-line">
              <strong>${service.firmaNombreReceptor || ''}</strong>
            </div>
            <div class="signature-label">Receptor del Servicio</div>
          </div>`
              : `<div class="signature-box">
            <span style="color: #cbd5e1; font-size: 9pt;">Firma pendiente</span>
          </div>
          <div class="signature-info" style="margin-top: 4px;">
            <div class="signature-line" style="color: #cbd5e1;">&nbsp;</div>
            <div class="signature-label">Receptor del Servicio</div>
          </div>`
          }
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Elemental Pro - Sistema de Gestión de Servicios Técnicos</div>
    <div>Generado el ${generatedAt}</div>
    <div>OT: ${service.ordenTrabajo}</div>
  </div>

</body>
</html>`;
}

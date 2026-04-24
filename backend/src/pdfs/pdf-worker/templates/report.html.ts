import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
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
      <div class="logo-icon">⚡</div>
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
              <strong>${service.nombreTecnico}</strong>
            </div>
            <div class="signature-label">Técnico Responsable</div>
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
    <div>Generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</div>
    <div>OT: ${service.ordenTrabajo}</div>
  </div>

</body>
</html>`;
}

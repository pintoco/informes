import apiClient from './client';
import { MonthlyReport, ReportPeriod, Company } from '@/types';

// Rango del informe: `from` solo = período de la institución; con `to` = fechas elegidas a mano
export interface ReportRange {
  from: string;
  to?: string;
}

export const getReportPeriods = async (
  companyId: string,
): Promise<{ company: Pick<Company, 'id' | 'name' | 'periodStartDay'>; periods: ReportPeriod[] }> => {
  const { data } = await apiClient.get('/reports/monthly/periods', { params: { companyId } });
  return data;
};

export const getMonthlyReport = async (companyId: string, range: ReportRange): Promise<MonthlyReport> => {
  const { data } = await apiClient.get<MonthlyReport>('/reports/monthly', { params: { companyId, ...range } });
  return data;
};

export const generateMissingPdfs = async (companyId: string, range: ReportRange): Promise<{ queued: number }> => {
  const { data } = await apiClient.post('/reports/monthly/generate-missing', { companyId, ...range });
  return data;
};

// Descarga un archivo del informe (PDF consolidado o ZIP). Armar el consolidado
// puede tardar: se amplía el timeout respecto del cliente por defecto (30 s).
export const downloadMonthlyFile = async (
  kind: 'pdf' | 'zip',
  companyId: string,
  range: ReportRange,
): Promise<void> => {
  const response = await apiClient.get(`/reports/monthly/${kind}`, {
    params: { companyId, ...range },
    responseType: 'blob',
    timeout: 180_000,
  });
  const disposition: string = response.headers['content-disposition'] || '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || `informe-mensual.${kind}`;
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

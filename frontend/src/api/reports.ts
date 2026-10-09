import apiClient from './client';
import { MonthlyReport, ReportPeriod, Company } from '@/types';

export const getReportPeriods = async (
  companyId: string,
): Promise<{ company: Pick<Company, 'id' | 'name' | 'periodStartDay'>; periods: ReportPeriod[] }> => {
  const { data } = await apiClient.get('/reports/monthly/periods', { params: { companyId } });
  return data;
};

export const getMonthlyReport = async (companyId: string, from: string): Promise<MonthlyReport> => {
  const { data } = await apiClient.get<MonthlyReport>('/reports/monthly', { params: { companyId, from } });
  return data;
};

export const generateMissingPdfs = async (companyId: string, from: string): Promise<{ queued: number }> => {
  const { data } = await apiClient.post('/reports/monthly/generate-missing', { companyId, from });
  return data;
};

// Descarga un archivo del informe (PDF consolidado o ZIP). Armar el consolidado
// puede tardar: se amplía el timeout respecto del cliente por defecto (30 s).
export const downloadMonthlyFile = async (
  kind: 'pdf' | 'zip',
  companyId: string,
  from: string,
): Promise<void> => {
  const response = await apiClient.get(`/reports/monthly/${kind}`, {
    params: { companyId, from },
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

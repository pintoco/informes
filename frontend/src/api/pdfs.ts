import apiClient from './client';
import { ServicePdf } from '@/types';

export const requestPdf = async (serviceId: string): Promise<ServicePdf> => {
  const { data } = await apiClient.post<ServicePdf>(
    `/services/${serviceId}/pdfs`
  );
  return data;
};

export const getPdfStatus = async (
  serviceId: string,
  pdfId: string
): Promise<ServicePdf> => {
  const { data } = await apiClient.get<ServicePdf>(
    `/services/${serviceId}/pdfs/${pdfId}`
  );
  return data;
};

export const downloadPdf = (url: string): void => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

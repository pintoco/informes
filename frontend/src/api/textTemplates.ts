import apiClient from './client';
import { TextTemplate } from '@/types';

export const listTextTemplates = async (): Promise<TextTemplate[]> => {
  const { data } = await apiClient.get<TextTemplate[]>('/text-templates');
  return data;
};

export const createTextTemplate = async (
  dto: Pick<TextTemplate, 'title' | 'body'> & { orden?: number },
): Promise<TextTemplate> => {
  const { data } = await apiClient.post<TextTemplate>('/text-templates', dto);
  return data;
};

export const updateTextTemplate = async (
  id: string,
  dto: Partial<Pick<TextTemplate, 'title' | 'body' | 'orden'>>,
): Promise<TextTemplate> => {
  const { data } = await apiClient.put<TextTemplate>(`/text-templates/${id}`, dto);
  return data;
};

export const deleteTextTemplate = async (id: string): Promise<void> => {
  await apiClient.delete(`/text-templates/${id}`);
};

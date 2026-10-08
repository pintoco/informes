import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, Edit, Plus, Trash2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  listTextTemplates, createTextTemplate, updateTextTemplate, deleteTextTemplate,
} from '@/api/textTemplates';
import { TextTemplate } from '@/types';

type Draft = { id?: string; title: string; body: string };

// Textos predefinidos que se insertan en "Comentario Cámaras" y "Observaciones"
// del formulario de servicio. Solo ADMIN.
export function TextTemplatesPage() {
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<TextTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    listTextTemplates()
      .then(setTemplates)
      .catch(() => toast.error('No se pudieron cargar los textos'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    if (!draft || !draft.title.trim() || !draft.body.trim()) return;
    setSaving(true);
    try {
      if (draft.id) {
        await updateTextTemplate(draft.id, { title: draft.title.trim(), body: draft.body.trim() });
      } else {
        await createTextTemplate({ title: draft.title.trim(), body: draft.body.trim() });
      }
      toast.success('Texto guardado');
      setDraft(null);
      load();
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTextTemplate(deleting.id);
      toast.success('Texto eliminado');
      setDeleting(null);
      load();
    } catch {
      toast.error('No se pudo eliminar');
    }
  };

  // Intercambia el orden con el vecino (arriba/abajo)
  const move = async (index: number, delta: -1 | 1) => {
    const other = templates[index + delta];
    const current = templates[index];
    if (!other) return;
    try {
      await Promise.all([
        updateTextTemplate(current.id, { orden: index + delta + 1 }),
        updateTextTemplate(other.id, { orden: index + 1 }),
      ]);
      load();
    } catch {
      toast.error('No se pudo reordenar');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Textos predefinidos</h1>
            <p className="text-gray-500 text-sm mt-1">
              Se insertan con un clic en los comentarios del servicio. Usa [completar] para marcar lo que hay que ajustar.
            </p>
          </div>
          <Button onClick={() => setDraft({ title: '', body: '' })}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo texto
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No hay textos predefinidos.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((t, i) => (
              <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{t.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3 whitespace-pre-line">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} title="Subir">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" onClick={() => move(i, 1)}
                      disabled={i === templates.length - 1} title="Bajar"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Editar"
                      onClick={() => setDraft({ id: t.id, title: t.title, body: t.body })}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Eliminar"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={() => setDraft(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar texto' : 'Nuevo texto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="tpl-title">Título</Label>
              <Input
                id="tpl-title"
                value={draft?.title ?? ''}
                maxLength={100}
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                placeholder="Ej: Mantenimiento preventivo"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-body">Texto</Label>
              <Textarea
                id="tpl-body"
                rows={12}
                maxLength={5000}
                value={draft?.body ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, body: e.target.value } : d))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !draft?.title.trim() || !draft?.body.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar texto</DialogTitle>
            <DialogDescription>
              ¿Eliminar "{deleting?.title}"? Los servicios que ya lo usan no cambian.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

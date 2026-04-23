import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Check, MapPin, Building2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Company } from '@/types';
import { listCompanies, createCompany, updateCompany, deleteCompany, addLocation, deleteLocation } from '@/api/companies';
import toast from 'react-hot-toast';

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Company form
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Location form
  const [addingLocationTo, setAddingLocationTo] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setCompanies(await listCompanies());
    } catch { toast.error('Error al cargar empresas'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreateCompany = () => {
    setEditingCompany(null);
    setCompanyName('');
    setShowCompanyForm(true);
  };

  const openEditCompany = (c: Company) => {
    setEditingCompany(c);
    setCompanyName(c.name);
    setShowCompanyForm(true);
  };

  const handleSaveCompany = async () => {
    if (!companyName.trim()) return toast.error('El nombre es requerido');
    setSavingCompany(true);
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, companyName.trim());
        toast.success('Empresa actualizada');
      } else {
        await createCompany(companyName.trim());
        toast.success('Empresa creada');
      }
      setShowCompanyForm(false);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar');
    } finally { setSavingCompany(false); }
  };

  const handleDeleteCompany = async (c: Company) => {
    if (!confirm(`¿Eliminar la empresa "${c.name}" y todas sus ubicaciones?`)) return;
    try {
      await deleteCompany(c.id);
      toast.success('Empresa eliminada');
      await load();
    } catch { toast.error('Error al eliminar'); }
  };

  const handleAddLocation = async (companyId: string) => {
    if (!locationName.trim()) return toast.error('El nombre es requerido');
    setSavingLocation(true);
    try {
      await addLocation(companyId, locationName.trim());
      toast.success('Ubicación agregada');
      setAddingLocationTo(null);
      setLocationName('');
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al agregar');
    } finally { setSavingLocation(false); }
  };

  const handleDeleteLocation = async (companyId: string, locationId: string, name: string) => {
    if (!confirm(`¿Eliminar la ubicación "${name}"?`)) return;
    try {
      await deleteLocation(companyId, locationId);
      toast.success('Ubicación eliminada');
      await load();
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Empresas y Ubicaciones</h1>
            <p className="text-sm text-gray-500">{companies.length} empresa{companies.length !== 1 ? 's' : ''} registrada{companies.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openCreateCompany}>
            <Plus className="h-4 w-4 mr-2" />Nueva Empresa
          </Button>
        </div>

        {/* Company form */}
        {showCompanyForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
              <button onClick={() => setShowCompanyForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-1 max-w-md">
              <Label>Nombre de la empresa *</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="Empresa S.A." onKeyDown={e => e.key === 'Enter' && handleSaveCompany()} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCompanyForm(false)}>Cancelar</Button>
              <Button onClick={handleSaveCompany} disabled={savingCompany}>
                <Check className="h-4 w-4 mr-2" />{savingCompany ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}

        {/* Companies list */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay empresas registradas</p>
            <Button className="mt-4" onClick={openCreateCompany}>Agregar primera empresa</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(company => (
              <div key={company.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Company header */}
                <div className="flex items-center justify-between px-5 py-4">
                  <button className="flex items-center gap-3 text-left flex-1" onClick={() => toggleExpand(company.id)}>
                    {expanded.has(company.id)
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold text-gray-900">{company.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {company.locations.length} ubicación{company.locations.length !== 1 ? 'es' : ''}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => openEditCompany(company)} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDeleteCompany(company)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Locations */}
                {expanded.has(company.id) && (
                  <div className="border-t border-gray-100 px-5 py-3 space-y-2 bg-gray-50">
                    {company.locations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />
                          {loc.name}
                        </div>
                        <button onClick={() => handleDeleteLocation(company.id, loc.id, loc.name)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {/* Add location */}
                    {addingLocationTo === company.id ? (
                      <div className="flex gap-2 mt-2">
                        <Input value={locationName} onChange={e => setLocationName(e.target.value)}
                          placeholder="Nueva ubicación..." className="text-sm"
                          onKeyDown={e => e.key === 'Enter' && handleAddLocation(company.id)} autoFocus />
                        <Button size="sm" onClick={() => handleAddLocation(company.id)} disabled={savingLocation}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAddingLocationTo(null); setLocationName(''); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingLocationTo(company.id); setLocationName(''); }}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors mt-1 px-3 py-1.5">
                        <Plus className="h-3.5 w-3.5" />Agregar ubicación
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

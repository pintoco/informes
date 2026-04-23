import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User } from '@/types';
import { listUsers, createUser, updateUser, deleteUser, CreateUserDto, UpdateUserDto } from '@/api/users';
import toast from 'react-hot-toast';

const roleLabel: Record<string, string> = { ADMIN: 'Administrador', TECHNICIAN: 'Técnico' };
const roleVariant: Record<string, 'info' | 'warning'> = { ADMIN: 'info', TECHNICIAN: 'warning' };

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<CreateUserDto>({ email: '', name: '', password: '', phone: '', role: 'TECHNICIAN' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setUsers(await listUsers());
    } catch { toast.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm({ email: '', name: '', password: '', phone: '', role: 'TECHNICIAN' });
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ email: u.email, name: u.name, password: '', phone: u.phone || '', role: u.role });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return toast.error('Nombre y email son requeridos');
    if (!editingUser && !form.password) return toast.error('La contraseña es requerida');
    setSaving(true);
    try {
      if (editingUser) {
        const dto: UpdateUserDto = { name: form.name, phone: form.phone, role: form.role };
        if (form.password) dto.password = form.password;
        await updateUser(editingUser.id, dto);
        toast.success('Usuario actualizado');
      } else {
        await createUser(form);
        toast.success('Usuario creado');
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`¿Eliminar a ${u.name}?`)) return;
    try {
      await deleteUser(u.id);
      toast.success('Usuario eliminado');
      await load();
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
            <p className="text-sm text-gray-500">{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Nuevo Usuario
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan Pérez" />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@empresa.com" disabled={!!editingUser} />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 1234 5678" />
              </div>
              <div className="space-y-1">
                <Label>{editingUser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="TECHNICIAN">Técnico</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                <Check className="h-4 w-4 mr-2" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No hay usuarios registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Nombre', 'Email', 'Teléfono', 'Rol', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleVariant[u.role]}>{roleLabel[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-blue-600 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(u)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

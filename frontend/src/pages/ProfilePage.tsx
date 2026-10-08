import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { updateProfile } from '@/api/profile';
import { UpdateProfileDto } from '@/types';

// Datos del usuario conectado. Nombre, teléfono y email de contacto son los que
// aparecen como "Responsable" en los servicios nuevos y en el informe PDF.
export function ProfilePage() {
  const { user, refreshUser, setSession } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhone(user.phone || '');
    setContactEmail(user.contactEmail || '');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && !currentPassword) {
      toast.error('Ingresa tu contraseña actual para cambiarla');
      return;
    }
    setSaving(true);
    try {
      const dto: UpdateProfileDto = { name, phone, contactEmail };
      if (newPassword) Object.assign(dto, { currentPassword, newPassword });
      const result = await updateProfile(dto);
      setSession(result.user, result.token);
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Perfil actualizado');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
          <p className="text-gray-500 text-sm mt-1">
            Estos datos aparecen como responsable en los servicios que registres y en el informe PDF.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Datos para los informes</h3>
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactEmail">Email para informes</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={user?.email}
              />
              <p className="text-xs text-gray-500">
                Opcional. Si lo dejas vacío se usa tu email de acceso ({user?.email}).
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Cambiar contraseña</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
              />
              <p className="text-xs text-gray-500">Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Layout>
  );
}

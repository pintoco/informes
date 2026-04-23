import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import LoginPage from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CreateServicePage } from '@/pages/CreateServicePage';
import { EditServicePage } from '@/pages/EditServicePage';
import { ServiceDetailPage } from '@/pages/ServiceDetailPage';
import { UsersPage } from '@/pages/UsersPage';
import { CompaniesPage } from '@/pages/CompaniesPage';

function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function PublicRoute() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#22c55e',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/services/new" element={<CreateServicePage />} />
          <Route path="/services/:id" element={<ServiceDetailPage />} />
          <Route path="/services/:id/edit" element={<EditServicePage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import OrdersList from './pages/OrdersList';
import OrderDetail from './pages/OrderDetail';
import Folders from './pages/Folders';
import Drawings from './pages/Drawings';
import Reports from './pages/Reports';
import TrashPage from './pages/Trash';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <ToastProvider>
      <div className="flex">
        <Sidebar />
        <main className="flex-1 mr-64 min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-order" element={<NewOrder />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/folders" element={<Folders />} />
          <Route path="/drawings" element={<Drawings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}

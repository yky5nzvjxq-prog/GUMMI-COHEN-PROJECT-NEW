import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
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
import OpenOrders from './pages/OpenOrders';
import ClosedOrders from './pages/ClosedOrders';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 min-h-screen transition-all duration-300">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-order" element={<NewOrder />} />
              <Route path="/orders" element={<OrdersList />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/open-orders" element={<OpenOrders />} />
              <Route path="/closed-orders" element={<ClosedOrders />} />
              <Route path="/folders" element={<Folders />} />
              <Route path="/drawings" element={<Drawings />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

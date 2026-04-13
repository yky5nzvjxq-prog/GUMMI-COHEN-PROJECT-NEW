import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Database, FileImage, FileSpreadsheet, FolderTree, Trash2, Settings } from 'lucide-react';
import { fetchSettings } from '../utils/api';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/new-order', icon: PlusCircle, label: 'הזמנה חדשה' },
  { to: '/orders', icon: Database, label: 'מאגר הזמנות' },
  { to: '/folders', icon: FolderTree, label: 'תיקיות' },
  { to: '/drawings', icon: FileImage, label: 'שרטוטים' },
  { to: '/reports', icon: FileSpreadsheet, label: 'דוחות ותעודות' },
  { to: '/trash', icon: Trash2, label: 'סל מחזור' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export default function Sidebar() {
  const [factoryName, setFactoryName] = useState('מפעל גומי');

  useEffect(() => {
    fetchSettings().then(data => {
      if (data && !data.error && data.factoryName) {
        setFactoryName(data.factoryName);
      }
    });
  }, []);

  return (
    <aside className="w-64 bg-navy-600 text-white min-h-screen flex flex-col fixed right-0 top-0 z-30">
      <div className="p-5 border-b border-navy-500">
        <h1 className="text-xl font-bold">{factoryName}</h1>
        <p className="text-navy-200 text-xs mt-1">מערכת ניהול הזמנות ובקרת איכות</p>
      </div>
      <nav className="flex-1 py-4">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive ? 'bg-navy-500 text-white font-semibold border-l-4 border-blue-400' : 'text-navy-200 hover:bg-navy-500/50 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-xs text-navy-300 border-t border-navy-500">
        v2.0 — Factory Dashboard
      </div>
    </aside>
  );
}

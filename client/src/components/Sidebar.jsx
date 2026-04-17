import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, Database, FileImage, FileSpreadsheet,
  FolderTree, Trash2, Settings, ClipboardList, Archive, Sun, Moon,
} from 'lucide-react';
import { fetchSettings } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'לוח בקרה' },
  { to: '/new-order', icon: PlusCircle, label: 'הזמנה חדשה' },
  { to: '/orders', icon: Database, label: 'מאגר הזמנות' },
  { to: '/open-orders', icon: ClipboardList, label: 'הזמנות פתוחות' },
  { to: '/closed-orders', icon: Archive, label: 'הזמנות סגורות' },
  { to: '/folders', icon: FolderTree, label: 'תיקיות' },
  { to: '/drawings', icon: FileImage, label: 'שרטוטים' },
  { to: '/reports', icon: FileSpreadsheet, label: 'דוחות ותעודות' },
  { to: '/trash', icon: Trash2, label: 'סל מחזור' },
  { to: '/settings', icon: Settings, label: 'הגדרות' },
];

export default function Sidebar() {
  const [factoryName, setFactoryName] = useState('מפעל גומי');
  const [expanded, setExpanded] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchSettings().then(data => {
      if (data && !data.error && data.factoryName) {
        setFactoryName(data.factoryName);
      }
    });
  }, []);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`${expanded ? 'w-64' : 'w-16'} bg-gray-900 text-white min-h-screen flex flex-col flex-shrink-0 sticky top-0 h-screen transition-all duration-300 overflow-hidden z-30`}
    >
      <div className={`p-4 border-b border-gray-700 ${expanded ? 'px-5' : 'px-3'} transition-all duration-300`}>
        <h1 className={`font-bold whitespace-nowrap overflow-hidden transition-all duration-200 ${expanded ? 'text-xl opacity-100' : 'text-[0px] opacity-0 h-6'}`}>
          {factoryName}
        </h1>
        <p className={`text-gray-400 text-xs mt-1 whitespace-nowrap overflow-hidden transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 h-0 mt-0'}`}>
          מערכת ניהול הזמנות ובקרת איכות
        </p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 py-3 text-sm transition-all duration-200 ${
                expanded ? 'px-5' : 'px-0 justify-center'
              } ${
                isActive
                  ? 'bg-gray-700 text-white font-semibold border-l-4 border-blue-400'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
      <div className={`p-3 border-t border-gray-700 flex items-center ${expanded ? 'justify-between px-4' : 'justify-center'}`}>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <span className={`text-xs text-gray-500 whitespace-nowrap overflow-hidden transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
          v2.0
        </span>
      </div>
    </aside>
  );
}

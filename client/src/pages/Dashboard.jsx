import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchOrders, openGeneratedFile } from '../utils/api';
import { statusBadge, formatDate } from '../utils/helpers';
import { useToast } from '../components/Toast';
import {
  Package, FileSpreadsheet, AlertCircle, PlusCircle,
  CheckCircle, Shield, Award, Download, FileText,
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const toast = useToast();

  useEffect(() => {
    fetchStats().then(setStats);
    fetchOrders().then(setOrders);
  }, []);

  if (!stats) return <div className="p-8 text-center text-gray-400">טוען...</div>;

  const recent = orders.slice(0, 5);
  const lastCOCOrder = orders.find(o => o.cocPath);
  const last5ExcelOrders = orders.filter(o => o.reportPath).slice(0, 5);

  async function handleOpen(orderId, kind) {
    const res = await openGeneratedFile(orderId, kind);
    if (res?.error) toast.error(res.error);
  }

  const cards = [
    { label: 'סה"כ הזמנות', value: stats.totalOrders, icon: Package, color: 'bg-blue-500', link: '/orders' },
    { label: 'ממתינים לאישור', value: stats.pendingReview || 0, icon: Shield, color: 'bg-orange-500', link: '/orders' },
    { label: 'אושרו', value: stats.approved || 0, icon: CheckCircle, color: 'bg-emerald-500', link: '/orders' },
    { label: 'דוחות שנוצרו', value: stats.reportsGenerated, icon: FileSpreadsheet, color: 'bg-green-500', link: '/reports' },
    { label: 'הזמנות חדשות', value: stats.newOrders, icon: AlertCircle, color: 'bg-purple-500', link: '/orders' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">לוח בקרה</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">סקירה כללית של מערכת ניהול ההזמנות</p>
        </div>
        <Link
          to="/new-order"
          className="bg-gray-800 dark:bg-gray-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <PlusCircle size={16} />
          הזמנה חדשה
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`${color} text-white p-3 rounded-lg`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Last C.O.C + Last 5 Excel reports row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Last C.O.C */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm lg:col-span-1">
          <div className="p-5 border-b dark:border-gray-700 flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">תעודת התאמה אחרונה</h2>
          </div>
          {lastCOCOrder ? (
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-3 rounded-lg">
                  <FileText size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    הזמנה {lastCOCOrder.orderNumber}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {lastCOCOrder.customerName} · {lastCOCOrder.partName}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDate(lastCOCOrder.updatedAt || lastCOCOrder.createdAt)}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleOpen(lastCOCOrder.id, 'coc')}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-medium"
                >
                  <Download size={14} />
                  הורד C.O.C
                </button>
                <Link
                  to={`/orders/${lastCOCOrder.id}`}
                  className="inline-flex items-center justify-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  פרטים
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Award size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">עדיין לא הופקה תעודת התאמה</p>
            </div>
          )}
        </div>

        {/* Last 5 Excel reports */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm lg:col-span-2">
          <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-green-500" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">5 דוחות אקסל אחרונים</h2>
            </div>
            <Link to="/reports" className="text-sm text-blue-500 hover:underline">הצג הכל</Link>
          </div>
          {last5ExcelOrders.length === 0 ? (
            <div className="p-8 text-center">
              <FileSpreadsheet size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 dark:text-gray-500">עדיין לא הופקו דוחות אקסל</p>
            </div>
          ) : (
            <ul className="divide-y dark:divide-gray-700">
              {last5ExcelOrders.map(o => (
                <li key={o.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-2 rounded-lg shrink-0">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      הזמנה {o.orderNumber} · {o.partName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {o.customerName} · {formatDate(o.updatedAt || o.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleOpen(o.id, 'report')}
                      title="הורד דוח אקסל"
                      className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-md text-xs font-medium"
                    >
                      <Download size={12} />
                      הורד
                    </button>
                    <Link
                      to={`/orders/${o.id}`}
                      className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      פרטים
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <Package size={48} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">אין הזמנות עדיין</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">צור את ההזמנה הראשונה שלך כדי להתחיל</p>
          <Link
            to="/new-order"
            className="inline-flex items-center gap-2 bg-gray-800 dark:bg-gray-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-600"
          >
            <PlusCircle size={16} />
            הזמנה חדשה
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-5 border-b dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">הזמנות אחרונות</h2>
            <Link to="/orders" className="text-sm text-blue-500 hover:underline">הצג הכל</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-right p-3">מס' הזמנה</th>
                <th className="text-right p-3">לקוח</th>
                <th className="text-right p-3">שם חלק</th>
                <th className="text-right p-3">תאריך</th>
                <th className="text-right p-3">סטטוס</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="dark:text-gray-300">
              {recent.map(order => {
                const st = statusBadge(order.status);
                return (
                  <tr key={order.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3 font-medium">{order.orderNumber}</td>
                    <td className="p-3">{order.customerName}</td>
                    <td className="p-3">{order.partName}</td>
                    <td className="p-3">{formatDate(order.date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
                    </td>
                    <td className="p-3">
                      <Link to={`/orders/${order.id}`} className="text-blue-500 hover:underline text-xs">פרטים</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

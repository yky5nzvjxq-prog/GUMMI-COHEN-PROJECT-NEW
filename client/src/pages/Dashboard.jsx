import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchOrders } from '../utils/api';
import { statusBadge, formatDate } from '../utils/helpers';
import { Package, FileImage, FileSpreadsheet, Clock, AlertCircle, PlusCircle, CheckCircle, Shield } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetchStats().then(setStats);
    fetchOrders().then(orders => setRecent(orders.slice(0, 5)));
  }, []);

  if (!stats) return <div className="p-8 text-center text-gray-400">טוען...</div>;

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
          <h1 className="text-2xl font-bold text-navy-600">לוח בקרה</h1>
          <p className="text-gray-500 text-sm mt-1">סקירה כללית של מערכת ניהול ההזמנות</p>
        </div>
        <Link
          to="/new-order"
          className="bg-navy-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-500 transition-colors flex items-center gap-2"
        >
          <PlusCircle size={16} />
          הזמנה חדשה
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`${color} text-white p-3 rounded-lg`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-navy-600">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {recent.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package size={48} className="mx-auto text-gray-200 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">אין הזמנות עדיין</h3>
          <p className="text-sm text-gray-400 mb-4">צור את ההזמנה הראשונה שלך כדי להתחיל</p>
          <Link
            to="/new-order"
            className="inline-flex items-center gap-2 bg-navy-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-navy-500"
          >
            <PlusCircle size={16} />
            הזמנה חדשה
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-5 border-b flex justify-between items-center">
            <h2 className="font-semibold text-navy-600">הזמנות אחרונות</h2>
            <Link to="/orders" className="text-sm text-blue-500 hover:underline">הצג הכל</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-right p-3">מס' הזמנה</th>
                <th className="text-right p-3">לקוח</th>
                <th className="text-right p-3">שם חלק</th>
                <th className="text-right p-3">תאריך</th>
                <th className="text-right p-3">סטטוס</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {recent.map(order => {
                const st = statusBadge(order.status);
                return (
                  <tr key={order.id} className="border-t hover:bg-gray-50">
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

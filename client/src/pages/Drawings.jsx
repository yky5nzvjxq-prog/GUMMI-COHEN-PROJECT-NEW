import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders } from '../utils/api';
import { formatDate } from '../utils/helpers';
import { FileImage } from 'lucide-react';

export default function Drawings() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders().then(all => {
      setOrders(all.filter(o => o.files?.drawing || o.fileName));
    });
  }, []);

  function getDrawingName(order) {
    return order.files?.drawing?.originalName || order.fileName || '';
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">שרטוטים שהועלו</h1>

      {orders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center text-gray-400">
          <FileImage size={48} className="mx-auto mb-3 opacity-50" />
          <p>עדיין לא הועלו שרטוטים</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => (
            <Link key={order.id} to={`/orders/${order.id}`} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-lg">
                  <FileImage size={20} className="text-blue-500" />
                </div>
                <div>
                  <div className="font-medium text-sm dark:text-gray-200">{getDrawingName(order)}</div>
                  <div className="text-xs text-gray-400">{order.orderNumber}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>לקוח: {order.customerName}</div>
                <div>חלק: {order.partName}</div>
                <div>תאריך: {formatDate(order.date)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

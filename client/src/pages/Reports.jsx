import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders, downloadReportUrl, downloadCOCUrl } from '../utils/api';
import { formatDate } from '../utils/helpers';
import { FileSpreadsheet, Download, Award } from 'lucide-react';

export default function Reports() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders().then(all => {
      setOrders(all.filter(o => o.reportPath || o.cocPath));
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy-600 mb-6">דוחות ותעודות</h1>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <FileSpreadsheet size={48} className="mx-auto mb-3 opacity-50" />
          <p>עדיין לא נוצרו דוחות</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-right p-3">מס' הזמנה</th>
                <th className="text-right p-3">לקוח</th>
                <th className="text-right p-3">שם החלק</th>
                <th className="text-right p-3">תאריך</th>
                <th className="p-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{order.orderNumber}</td>
                  <td className="p-3">{order.customerName}</td>
                  <td className="p-3">{order.partName}</td>
                  <td className="p-3">{formatDate(order.date)}</td>
                  <td className="p-3">
                    <div className="flex gap-2 flex-wrap">
                      {order.reportPath && (
                        <a href={downloadReportUrl(order.id)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-500 transition-colors">
                          <Download size={14} /> דוח Excel
                        </a>
                      )}
                      {order.cocPath && (
                        <a href={downloadCOCUrl(order.id)} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-purple-500 transition-colors">
                          <Award size={14} /> תעודת התאמה (Word)
                        </a>
                      )}
                      <Link to={`/orders/${order.id}`} className="text-blue-500 hover:underline text-xs py-1.5">פרטים</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

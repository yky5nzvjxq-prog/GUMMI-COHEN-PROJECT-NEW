import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders, fetchFolders, deleteOrder, downloadReportUrl, downloadCOCUrl } from '../utils/api';
import { statusBadge, formatDate, STATUS_MAP } from '../utils/helpers';
import { useToast } from '../components/Toast';
import { Search, Download, Award, Trash2 } from 'lucide-react';

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchOrders().then(setOrders);
    fetchFolders().then(data => { if (Array.isArray(data)) setFolders(data); });
  }, []);

  // Build folder options with hierarchy
  function buildFolderOptions(parentId = null, depth = 0) {
    return folders
      .filter(f => f.parentId === parentId)
      .flatMap(f => [
        { id: f.id, label: '\u00A0\u00A0'.repeat(depth) + f.name },
        ...buildFolderOptions(f.id, depth + 1),
      ]);
  }

  const filtered = orders.filter(o => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      o.orderNumber?.toLowerCase().includes(s) ||
      o.customerName?.toLowerCase().includes(s) ||
      o.partName?.toLowerCase().includes(s) ||
      o.drawingNumber?.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchFolder = folderFilter === 'all' || (folderFilter === 'unfiled' ? !o.folderId : o.folderId === folderFilter);
    const matchDateFrom = !dateFrom || o.date >= dateFrom;
    const matchDateTo = !dateTo || o.date <= dateTo;
    return matchSearch && matchStatus && matchFolder && matchDateFrom && matchDateTo;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-600">מאגר הזמנות</h1>
        <Link to="/new-order" className="bg-navy-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-navy-500 transition-colors">
          + הזמנה חדשה
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש לפי הזמנה, לקוח, חלק, שרטוט..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="all">כל הסטטוסים</option>
              {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={folderFilter}
              onChange={e => setFolderFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="all">כל התיקיות</option>
              <option value="unfiled">ללא תיקייה</option>
              {buildFolderOptions().map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>מתאריך:</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>עד תאריך:</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
            </div>
            {(search || statusFilter !== 'all' || folderFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('all'); setFolderFilter('all'); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                נקה סינון
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right p-3">מס' הזמנה</th>
              <th className="text-right p-3">לקוח</th>
              <th className="text-right p-3">שם החלק</th>
              <th className="text-right p-3">מס' שרטוט</th>
              <th className="text-right p-3">כמות</th>
              <th className="text-right p-3">תאריך</th>
              <th className="text-right p-3">סטטוס</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const st = statusBadge(order.status);
              return (
                <tr key={order.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{order.orderNumber}</td>
                  <td className="p-3">{order.customerName}</td>
                  <td className="p-3">{order.partName}</td>
                  <td className="p-3 text-gray-500">{order.drawingNumber}</td>
                  <td className="p-3">{order.quantity}</td>
                  <td className="p-3">{formatDate(order.date)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1.5 items-center">
                      {order.reportPath && (
                        <a href={downloadReportUrl(order.id)} title="הורד דוח Excel"
                          className="bg-green-600 text-white p-1.5 rounded hover:bg-green-500 transition-colors">
                          <Download size={12} />
                        </a>
                      )}
                      {order.cocPath && (
                        <a href={downloadCOCUrl(order.id)} title="הורד תעודת התאמה"
                          className="bg-purple-600 text-white p-1.5 rounded hover:bg-purple-500 transition-colors">
                          <Award size={12} />
                        </a>
                      )}
                      <Link to={`/orders/${order.id}`} className="text-blue-500 hover:underline text-xs">פרטים</Link>
                      <button
                        onClick={() => setDeleteTarget(order)}
                        title="מחק הזמנה"
                        className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">לא נמצאו הזמנות</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">מחיקת הזמנה</h3>
            <p className="text-sm text-gray-600 mb-4">
              האם למחוק את הזמנה <strong>{deleteTarget.orderNumber}</strong>?
              <br />ההזמנה תועבר לסל המחזור וניתן יהיה לשחזר אותה.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                ביטול
              </button>
              <button
                onClick={async () => {
                  const result = await deleteOrder(deleteTarget.id);
                  if (result.error) { toast.error(result.error); } else {
                    toast.success(`הזמנה ${deleteTarget.orderNumber} הועברה לסל המחזור`);
                    setOrders(prev => prev.filter(o => o.id !== deleteTarget.id));
                  }
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOrders, fetchFolders, deleteOrder, downloadReportUrl, downloadCOCUrl } from '../utils/api';
import { statusBadge, formatDate } from '../utils/helpers';
import { useToast } from '../components/Toast';
import { Search, Download, Award, Trash2, ClipboardList } from 'lucide-react';

const OPEN_STATUSES = ['new', 'pending_review', 'drawing_uploaded', 'report_generated'];

export default function OpenOrders() {
  const [orders, setOrders] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const toast = useToast();
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchOrders().then(all => setOrders(all.filter(o => OPEN_STATUSES.includes(o.status))));
    fetchFolders().then(data => { if (Array.isArray(data)) setFolders(data); });
  }, []);

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
    const matchFolder = folderFilter === 'all' || (folderFilter === 'unfiled' ? !o.folderId : o.folderId === folderFilter);
    const matchDateFrom = !dateFrom || o.date >= dateFrom;
    const matchDateTo = !dateTo || o.date <= dateTo;
    return matchSearch && matchFolder && matchDateFrom && matchDateTo;
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">הזמנות פתוחות</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} הזמנות בתהליך</p>
        </div>
        <Link to="/new-order" className="bg-gray-800 dark:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
          + הזמנה חדשה
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        {/* Filters */}
        <div className="p-4 border-b dark:border-gray-700 space-y-3">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש לפי הזמנה, לקוח, חלק, שרטוט..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
            <select
              value={folderFilter}
              onChange={e => setFolderFilter(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="all">כל התיקיות</option>
              <option value="unfiled">ללא תיקייה</option>
              {buildFolderOptions().map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>מתאריך:</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>עד תאריך:</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none" />
            </div>
            {(search || folderFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearch(''); setFolderFilter('all'); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                נקה סינון
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
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
          <tbody className="dark:text-gray-300">
            {filtered.map(order => {
              const st = statusBadge(order.status);
              return (
                <tr key={order.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="p-3 font-medium">{order.orderNumber}</td>
                  <td className="p-3">{order.customerName}</td>
                  <td className="p-3">{order.partName}</td>
                  <td className="p-3 text-gray-500 dark:text-gray-400">{order.drawingNumber}</td>
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
                        className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-400">
                  <ClipboardList size={40} className="mx-auto mb-3 opacity-50" />
                  <p>אין הזמנות פתוחות</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">מחיקת הזמנה</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              האם למחוק את הזמנה <strong>{deleteTarget.orderNumber}</strong>?
              <br />ההזמנה תועבר לסל המחזור וניתן יהיה לשחזר אותה.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
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

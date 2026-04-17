import React, { useEffect, useState } from 'react';
import { fetchTrash, restoreFromTrash, permanentDelete, emptyTrash } from '../utils/api';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/helpers';
import { Trash2, RotateCcw, AlertTriangle, XCircle, FolderOpen, FileText } from 'lucide-react';

export default function TrashPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const toast = useToast();

  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    const data = await fetchTrash();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function kindOf(item) {
    return item.kind || 'order';
  }

  function labelFor(item) {
    return kindOf(item) === 'folder'
      ? item.name
      : (item.orderNumber || '(ללא מס׳)');
  }

  async function handleRestore(item) {
    const result = await restoreFromTrash(item.id);
    if (result.error) { toast.error(result.error); return; }
    if (kindOf(item) === 'folder') {
      toast.success(`תיקייה "${item.name}" שוחזרה${result.relinked ? ` (${result.relinked} הזמנות חוברו מחדש)` : ''}`);
    } else {
      toast.success(`הזמנה ${item.orderNumber} שוחזרה`);
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  async function handlePermanentDelete(item) {
    const result = await permanentDelete(item.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(kindOf(item) === 'folder' ? `תיקייה נמחקה לצמיתות` : `הזמנה נמחקה לצמיתות`);
    setItems(prev => prev.filter(i => i.id !== item.id));
    setConfirmDelete(null);
  }

  async function handleEmptyTrash() {
    const result = await emptyTrash();
    if (result.error) { toast.error(result.error); return; }
    toast.success('סל המחזור רוקן');
    setItems([]);
    setConfirmEmpty(false);
  }

  if (loading) return <div className="p-8 text-gray-400">טוען...</div>;

  const folderCount = items.filter(i => kindOf(i) === 'folder').length;
  const orderCount = items.length - folderCount;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">סל מחזור</h1>
          <p className="text-sm text-gray-400 mt-1">
            {items.length === 0 ? 'ריק' : `${orderCount} הזמנות · ${folderCount} תיקיות — ניתן לשחזר או למחוק לצמיתות.`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            <Trash2 size={16} />
            רוקן סל מחזור
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center text-gray-400">
          <Trash2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>סל המחזור ריק</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-right p-3 w-24">סוג</th>
                <th className="text-right p-3">שם / מס' הזמנה</th>
                <th className="text-right p-3">פרטים</th>
                <th className="text-right p-3">נמחק בתאריך</th>
                <th className="p-3">פעולות</th>
              </tr>
            </thead>
            <tbody className="dark:text-gray-300">
              {items.map(item => {
                const kind = kindOf(item);
                const isFolder = kind === 'folder';
                return (
                  <tr key={item.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="p-3">
                      {isFolder ? (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                          {item.color && <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />}
                          <FolderOpen size={12} /> תיקייה
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full">
                          <FileText size={12} /> הזמנה
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium">{labelFor(item)}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">
                      {isFolder
                        ? `${(item.orderIds || []).length} הזמנות שוחזרו יחד`
                        : `${item.customerName || ''} · ${item.partName || ''}`}
                    </td>
                    <td className="p-3 text-gray-400">{formatDate(item.deletedAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestore(item)}
                          className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                          <RotateCcw size={12} /> שחזר
                        </button>
                        <button
                          onClick={() => setConfirmDelete(item)}
                          className="flex items-center gap-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        >
                          <XCircle size={12} /> מחק לצמיתות
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm permanent delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">מחיקה לצמיתות</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              האם למחוק לצמיתות את <strong>{labelFor(confirmDelete)}</strong>?
            </p>
            <p className="text-xs text-red-500 mb-4 flex items-center gap-1">
              <AlertTriangle size={12} />
              {kindOf(confirmDelete) === 'folder'
                ? 'פעולה זו אינה הפיכה — התיקייה תאבד לצמיתות.'
                : 'פעולה זו אינה הפיכה — כל הקבצים יימחקו.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                ביטול
              </button>
              <button onClick={() => handlePermanentDelete(confirmDelete)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500">
                מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm empty trash */}
      {confirmEmpty && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">ריקון סל המחזור</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              האם לרוקן את סל המחזור? <strong>{items.length} פריטים</strong> יימחקו לצמיתות.
            </p>
            <p className="text-xs text-red-500 mb-4 flex items-center gap-1">
              <AlertTriangle size={12} /> פעולה זו אינה הפיכה.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmEmpty(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                ביטול
              </button>
              <button onClick={handleEmptyTrash} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500">
                רוקן
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

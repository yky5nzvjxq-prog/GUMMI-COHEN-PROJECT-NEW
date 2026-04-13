import React, { useEffect, useState } from 'react';
import { fetchTrash, restoreFromTrash, permanentDelete, emptyTrash } from '../utils/api';
import { useToast } from '../components/Toast';
import { formatDate, statusBadge } from '../utils/helpers';
import { Trash2, RotateCcw, AlertTriangle, XCircle } from 'lucide-react';

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
    setItems(data);
    setLoading(false);
  }

  async function handleRestore(item) {
    const result = await restoreFromTrash(item.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`הזמנה ${item.orderNumber} שוחזרה בהצלחה`);
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  async function handlePermanentDelete(item) {
    const result = await permanentDelete(item.id);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`הזמנה ${item.orderNumber} נמחקה לצמיתות`);
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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-600">סל מחזור</h1>
          <p className="text-sm text-gray-400 mt-1">הזמנות שנמחקו. ניתן לשחזר או למחוק לצמיתות.</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100 transition-colors"
          >
            <Trash2 size={16} />
            רוקן סל מחזור
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400">
          <Trash2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>סל המחזור ריק</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-right p-3">מס' הזמנה</th>
                <th className="text-right p-3">לקוח</th>
                <th className="text-right p-3">שם החלק</th>
                <th className="text-right p-3">נמחק בתאריך</th>
                <th className="p-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.orderNumber}</td>
                  <td className="p-3">{item.customerName}</td>
                  <td className="p-3">{item.partName}</td>
                  <td className="p-3 text-gray-400">{formatDate(item.deletedAt)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(item)}
                        className="flex items-center gap-1 bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs hover:bg-green-100 transition-colors"
                      >
                        <RotateCcw size={12} /> שחזר
                      </button>
                      <button
                        onClick={() => setConfirmDelete(item)}
                        className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-100 transition-colors"
                      >
                        <XCircle size={12} /> מחק לצמיתות
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm permanent delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">מחיקה לצמיתות</h3>
            <p className="text-sm text-gray-600 mb-1">
              האם למחוק לצמיתות את הזמנה <strong>{confirmDelete.orderNumber}</strong>?
            </p>
            <p className="text-xs text-red-500 mb-4 flex items-center gap-1">
              <AlertTriangle size={12} /> פעולה זו אינה הפיכה — כל הקבצים יימחקו.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
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
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">ריקון סל המחזור</h3>
            <p className="text-sm text-gray-600 mb-1">
              האם לרוקן את סל המחזור? <strong>{items.length} הזמנות</strong> יימחקו לצמיתות.
            </p>
            <p className="text-xs text-red-500 mb-4 flex items-center gap-1">
              <AlertTriangle size={12} /> פעולה זו אינה הפיכה.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmEmpty(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
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

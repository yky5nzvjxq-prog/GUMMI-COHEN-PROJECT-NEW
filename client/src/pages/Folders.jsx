import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchFolders, createFolder, updateFolder, deleteFolder,
  fetchOrders, updateOrder, downloadReportUrl, downloadCOCUrl,
} from '../utils/api';
import { useToast } from '../components/Toast';
import { statusBadge, formatDate } from '../utils/helpers';
import {
  FolderOpen, FolderPlus, ChevronDown, ChevronLeft,
  Edit3, Trash2, Download, Award, MoveRight,
} from 'lucide-react';

export default function Folders() {
  const [folders, setFolders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = unfiled
  const [expanded, setExpanded] = useState(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const toast = useToast();

  useEffect(() => { reload(); }, []);

  async function reload() {
    const [fData, oData] = await Promise.all([fetchFolders(), fetchOrders()]);
    if (Array.isArray(fData)) setFolders(fData);
    setOrders(oData);
  }

  // ─── Folder CRUD ──────────────────────────────────────────────────
  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const result = await createFolder({ name: newFolderName, parentId: newFolderParent || null });
    if (result.error) { toast.error(result.error); return; }
    toast.success(`תיקייה "${newFolderName}" נוצרה`);
    setNewFolderName('');
    setNewFolderParent('');
    setShowNewFolder(false);
    reload();
  }

  async function handleRenameFolder(id) {
    if (!editName.trim()) return;
    const result = await updateFolder(id, { name: editName });
    if (result.error) { toast.error(result.error); return; }
    setEditingId(null);
    reload();
  }

  async function handleDeleteFolder(id) {
    const result = await deleteFolder(id);
    if (result.error) { toast.error(result.error); return; }
    toast.info('תיקייה נמחקה');
    if (selectedFolder === id) setSelectedFolder(null);
    reload();
  }

  async function handleMoveOrder(orderId, folderId) {
    await updateOrder(orderId, { folderId: folderId || null });
    reload();
  }

  // ─── Toggle expand ────────────────────────────────────────────────
  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─── Get children of folder ───────────────────────────────────────
  function getChildren(parentId) {
    return folders.filter(f => f.parentId === parentId);
  }

  function getOrderCount(folderId) {
    return orders.filter(o => o.folderId === folderId).length;
  }

  // ─── Folder tree renderer ─────────────────────────────────────────
  function renderFolderTree(parentId = null, depth = 0) {
    const children = getChildren(parentId);
    if (children.length === 0) return null;

    return children.map(folder => {
      const hasChildren = getChildren(folder.id).length > 0;
      const isExpanded = expanded.has(folder.id);
      const isSelected = selectedFolder === folder.id;
      const count = getOrderCount(folder.id);

      return (
        <div key={folder.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
              isSelected ? 'bg-navy-600 text-white' : 'hover:bg-gray-100 text-gray-700'
            }`}
            style={{ paddingRight: `${12 + depth * 16}px` }}
          >
            {hasChildren ? (
              <button onClick={() => toggleExpand(folder.id)} className="flex-shrink-0">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            <button onClick={() => setSelectedFolder(folder.id)} className="flex-1 text-right flex items-center gap-2">
              <FolderOpen size={16} />
              {editingId === folder.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={() => handleRenameFolder(folder.id)}
                  onClick={e => e.stopPropagation()}
                  className="border border-blue-400 rounded px-1 py-0.5 text-sm text-gray-800 w-full"
                />
              ) : (
                <span>{folder.name}</span>
              )}
              {count > 0 && <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>({count})</span>}
            </button>

            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setEditingId(folder.id); setEditName(folder.name); }}
                className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setConfirmDeleteFolder(folder); }}
                className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          {isExpanded && renderFolderTree(folder.id, depth + 1)}
        </div>
      );
    });
  }

  // ─── Filtered orders ──────────────────────────────────────────────
  const folderOrders = selectedFolder === null
    ? orders.filter(o => !o.folderId)
    : orders.filter(o => o.folderId === selectedFolder);

  const folderName = selectedFolder === null
    ? 'ללא תיקייה'
    : folders.find(f => f.id === selectedFolder)?.name || '';

  // Build flat folder list for move dropdown
  function buildFolderOptions(parentId = null, depth = 0) {
    return folders
      .filter(f => f.parentId === parentId)
      .flatMap(f => [
        { id: f.id, label: '\u00A0\u00A0'.repeat(depth) + f.name },
        ...buildFolderOptions(f.id, depth + 1),
      ]);
  }

  return (
    <div className="p-8 flex gap-6 h-[calc(100vh-2rem)]">
      {/* Sidebar: Folder Tree */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-navy-600">תיקיות</h2>
            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="text-blue-500 hover:text-blue-600"
            >
              <FolderPlus size={18} />
            </button>
          </div>

          {showNewFolder && (
            <div className="mb-4 space-y-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
                placeholder="שם תיקייה..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              />
              <select
                value={newFolderParent}
                onChange={e => setNewFolderParent(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none"
              >
                <option value="">שורש (ללא אב)</option>
                {buildFolderOptions().map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleCreateFolder} className="bg-navy-600 text-white px-3 py-1 rounded text-xs hover:bg-navy-500">צור</button>
                <button onClick={() => setShowNewFolder(false)} className="text-gray-400 text-xs hover:text-gray-600">ביטול</button>
              </div>
            </div>
          )}

          {/* Unfiled */}
          <button
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors mb-1 w-full text-right ${
              selectedFolder === null ? 'bg-navy-600 text-white' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <FolderOpen size={16} />
            <span>ללא תיקייה</span>
            <span className={`text-xs ${selectedFolder === null ? 'text-white/70' : 'text-gray-400'}`}>
              ({orders.filter(o => !o.folderId).length})
            </span>
          </button>

          {/* Folder tree */}
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {renderFolderTree()}
          </div>
        </div>
      </div>

      {/* Main: Orders in selected folder */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl shadow-sm h-full flex flex-col">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-navy-600">{folderName}</h2>
            <p className="text-xs text-gray-400">{folderOrders.length} הזמנות</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {folderOrders.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <FolderOpen size={40} className="mx-auto mb-3 opacity-50" />
                <p>אין הזמנות בתיקייה זו</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-right p-3">מס' הזמנה</th>
                    <th className="text-right p-3">לקוח</th>
                    <th className="text-right p-3">חלק</th>
                    <th className="text-right p-3">תאריך</th>
                    <th className="text-right p-3">סטטוס</th>
                    <th className="p-3">העבר</th>
                    <th className="p-3">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {folderOrders.map(order => {
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
                          <select
                            value={order.folderId || ''}
                            onChange={e => handleMoveOrder(order.id, e.target.value || null)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs outline-none"
                          >
                            <option value="">ללא תיקייה</option>
                            {buildFolderOptions().map(f => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1.5">
                            {order.reportPath && (
                              <a href={downloadReportUrl(order.id)} className="bg-green-600 text-white p-1.5 rounded hover:bg-green-500">
                                <Download size={12} />
                              </a>
                            )}
                            {order.cocPath && (
                              <a href={downloadCOCUrl(order.id)} className="bg-purple-600 text-white p-1.5 rounded hover:bg-purple-500">
                                <Award size={12} />
                              </a>
                            )}
                            <Link to={`/orders/${order.id}`} className="text-blue-500 hover:underline text-xs py-1">פרטים</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Folder delete confirmation */}
      {confirmDeleteFolder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 mb-2">מחיקת תיקייה</h3>
            <p className="text-sm text-gray-600 mb-4">
              האם למחוק את תיקייה "<strong>{confirmDeleteFolder.name}</strong>"?
              <br />הזמנות בתיקייה יועברו לתיקיית האב. תיקיות משנה יועברו לשורש.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteFolder(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                ביטול
              </button>
              <button
                onClick={async () => {
                  await handleDeleteFolder(confirmDeleteFolder.id);
                  setConfirmDeleteFolder(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500"
              >
                מחק תיקייה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

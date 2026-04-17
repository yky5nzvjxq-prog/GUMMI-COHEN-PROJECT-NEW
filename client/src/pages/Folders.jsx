import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchFolders, createFolder, updateFolder, deleteFolder,
  fetchOrders, updateOrder, bulkMoveOrders,
  downloadReportUrl, downloadCOCUrl,
} from '../utils/api';
import { useToast } from '../components/Toast';
import { statusBadge, formatDate } from '../utils/helpers';
import {
  FolderOpen, FolderPlus, ChevronDown, ChevronLeft,
  Edit3, Trash2, Download, Award, Move, Check, X as XIcon, CheckSquare, Square,
} from 'lucide-react';

// Preset palette for folder colors. Empty string = no color (default gray).
const COLOR_SWATCHES = [
  { value: '', label: 'ללא' },
  { value: '#3B82F6', label: 'כחול' },
  { value: '#10B981', label: 'ירוק' },
  { value: '#F59E0B', label: 'כתום' },
  { value: '#EF4444', label: 'אדום' },
  { value: '#8B5CF6', label: 'סגול' },
  { value: '#EC4899', label: 'ורוד' },
  { value: '#14B8A6', label: 'טורקיז' },
  { value: '#6B7280', label: 'אפור' },
];

export default function Folders() {
  const [folders, setFolders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = unfiled
  const [expanded, setExpanded] = useState(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColorFor, setEditColorFor] = useState(null); // folder id currently showing color picker
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState(null); // folderId or '__unfiled__' while dragging
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
    const result = await createFolder({
      name: newFolderName,
      parentId: newFolderParent || null,
      color: newFolderColor,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success(`תיקייה "${newFolderName}" נוצרה`);
    setNewFolderName('');
    setNewFolderParent('');
    setNewFolderColor('');
    setShowNewFolder(false);
    reload();
  }

  async function handleRenameFolder(id) {
    if (!editName.trim()) return;
    const result = await updateFolder(id, { name: editName });
    if (result.error) { toast.error(result.error); setEditingId(null); return; }
    setEditingId(null);
    reload();
  }

  async function handleChangeColor(id, color) {
    const result = await updateFolder(id, { color });
    if (result.error) { toast.error(result.error); return; }
    setEditColorFor(null);
    reload();
  }

  async function handleDeleteFolder(id) {
    const result = await deleteFolder(id);
    if (result.error) { toast.error(result.error); return; }
    toast.info('תיקייה הועברה לסל המחזור');
    if (selectedFolder === id) setSelectedFolder(null);
    reload();
  }

  // Move a single order, used both by the select dropdown and by drag-drop.
  async function moveOrderTo(orderId, folderId) {
    const result = await updateOrder(orderId, { folderId: folderId || null });
    if (result.error) { toast.error(result.error); return; }
    reload();
  }

  async function handleBulkMove(folderId) {
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;
    const result = await bulkMoveOrders(ids, folderId);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`${result.moved} הזמנות הועברו`);
    setSelectedOrderIds(new Set());
    setBulkMoveOpen(false);
    reload();
  }

  // ─── Expand / collapse ────────────────────────────────────────────
  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  function getChildren(parentId) {
    return folders.filter(f => f.parentId === parentId);
  }
  function getOrderCount(folderId) {
    return orders.filter(o => o.folderId === folderId).length;
  }

  // Path from root to the selected folder, for breadcrumbs.
  const breadcrumbs = useMemo(() => {
    if (selectedFolder === null) return [];
    const path = [];
    let current = folders.find(f => f.id === selectedFolder);
    while (current) {
      path.unshift(current);
      current = current.parentId ? folders.find(f => f.id === current.parentId) : null;
    }
    return path;
  }, [selectedFolder, folders]);

  // ─── Drag helpers (HTML5 DnD) ─────────────────────────────────────
  function onOrderDragStart(e, orderId) {
    // If the order isn't already selected, the drag is treated as a single-order drag.
    const ids = selectedOrderIds.has(orderId)
      ? Array.from(selectedOrderIds)
      : [orderId];
    e.dataTransfer.setData('application/x-order-ids', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  }

  async function onFolderDrop(e, targetFolderId) {
    e.preventDefault();
    setDragOverFolder(null);
    const raw = e.dataTransfer.getData('application/x-order-ids');
    if (!raw) return;
    let ids;
    try { ids = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(ids) || ids.length === 0) return;
    const result = await bulkMoveOrders(ids, targetFolderId);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`${result.moved} ${result.moved === 1 ? 'הזמנה הועברה' : 'הזמנות הועברו'}`);
    setSelectedOrderIds(new Set());
    reload();
  }

  // ─── Folder tree renderer ─────────────────────────────────────────
  function renderFolderTree(parentId = null, depth = 0) {
    const children = getChildren(parentId);
    if (children.length === 0) return null;

    return children.map(folder => {
      const hasChildren = getChildren(folder.id).length > 0;
      const isExpanded = expanded.has(folder.id);
      const isSelected = selectedFolder === folder.id;
      const isDragOver = dragOverFolder === folder.id;
      const count = getOrderCount(folder.id);

      return (
        <div key={folder.id}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOverFolder(folder.id); }}
            onDragLeave={() => setDragOverFolder(prev => prev === folder.id ? null : prev)}
            onDrop={e => onFolderDrop(e, folder.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
              isSelected ? 'bg-gray-800 dark:bg-gray-600 text-white'
              : isDragOver ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            style={{ paddingRight: `${12 + depth * 16}px` }}
          >
            {hasChildren ? (
              <button onClick={() => toggleExpand(folder.id)} className="flex-shrink-0">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
              </button>
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}

            <button onClick={() => setSelectedFolder(folder.id)} className="flex-1 text-right flex items-center gap-2 min-w-0">
              {folder.color
                ? <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: folder.color }} />
                : <FolderOpen size={16} className="flex-shrink-0" />
              }
              {editingId === folder.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={() => handleRenameFolder(folder.id)}
                  onClick={e => e.stopPropagation()}
                  className="border border-blue-400 rounded px-1 py-0.5 text-sm text-gray-800 dark:text-gray-200 dark:bg-gray-700 w-full min-w-0"
                />
              ) : (
                <span className="truncate">{folder.name}</span>
              )}
              {count > 0 && <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'} flex-shrink-0`}>({count})</span>}
            </button>

            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setEditColorFor(editColorFor === folder.id ? null : folder.id); }}
                title="שנה צבע"
                className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}
              >
                <span className="inline-block w-3 h-3 rounded-full border border-current" style={folder.color ? { background: folder.color } : {}} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setEditingId(folder.id); setEditName(folder.name); }}
                title="שנה שם"
                className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setConfirmDeleteFolder(folder); }}
                title="מחק תיקייה"
                className={`p-1 rounded hover:bg-black/10 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {editColorFor === folder.id && (
            <div className="flex flex-wrap gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg mx-2 mb-1" style={{ marginRight: `${12 + depth * 16}px` }}>
              {COLOR_SWATCHES.map(sw => (
                <button
                  key={sw.value || 'none'}
                  onClick={() => handleChangeColor(folder.id, sw.value)}
                  title={sw.label}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${folder.color === sw.value ? 'border-gray-800 dark:border-gray-100 scale-110' : 'border-gray-200 dark:border-gray-600 hover:scale-110'}`}
                  style={sw.value ? { background: sw.value } : { background: 'transparent' }}
                >
                  {!sw.value && <XIcon size={12} className="mx-auto text-gray-400" />}
                </button>
              ))}
            </div>
          )}

          {isExpanded && renderFolderTree(folder.id, depth + 1)}
        </div>
      );
    });
  }

  // ─── Filtered orders for the main pane ───────────────────────────
  const folderOrders = selectedFolder === null
    ? orders.filter(o => !o.folderId)
    : orders.filter(o => o.folderId === selectedFolder);

  const folderName = selectedFolder === null
    ? 'ללא תיקייה'
    : folders.find(f => f.id === selectedFolder)?.name || '';

  const allVisibleSelected = folderOrders.length > 0 && folderOrders.every(o => selectedOrderIds.has(o.id));
  function toggleSelectAllVisible() {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        folderOrders.forEach(o => next.delete(o.id));
      } else {
        folderOrders.forEach(o => next.add(o.id));
      }
      return next;
    });
  }

  function buildFolderOptions(parentId = null, depth = 0) {
    return folders
      .filter(f => f.parentId === parentId)
      .flatMap(f => [
        { id: f.id, label: '\u00A0\u00A0'.repeat(depth) + f.name },
        ...buildFolderOptions(f.id, depth + 1),
      ]);
  }

  const selectedCount = selectedOrderIds.size;

  return (
    <div className="p-8 flex gap-6 h-[calc(100vh-2rem)]">
      {/* Sidebar: Folder Tree */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">תיקיות</h2>
            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="text-blue-500 hover:text-blue-600"
              title="צור תיקייה חדשה"
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
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                placeholder="שם תיקייה..."
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
              />
              <select
                value={newFolderParent}
                onChange={e => setNewFolderParent(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
              >
                <option value="">שורש (ללא אב)</option>
                {buildFolderOptions().map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1">
                {COLOR_SWATCHES.map(sw => (
                  <button
                    key={sw.value || 'none'}
                    onClick={() => setNewFolderColor(sw.value)}
                    title={sw.label}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${newFolderColor === sw.value ? 'border-gray-800 dark:border-gray-100 scale-110' : 'border-gray-200 dark:border-gray-600'}`}
                    style={sw.value ? { background: sw.value } : { background: 'transparent' }}
                  >
                    {!sw.value && <XIcon size={12} className="mx-auto text-gray-400" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateFolder} className="bg-gray-800 dark:bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 dark:hover:bg-gray-500">צור</button>
                <button onClick={() => setShowNewFolder(false)} className="text-gray-400 text-xs hover:text-gray-600">ביטול</button>
              </div>
            </div>
          )}

          {/* Unfiled — also a drop target */}
          <div
            onClick={() => setSelectedFolder(null)}
            onDragOver={e => { e.preventDefault(); setDragOverFolder('__unfiled__'); }}
            onDragLeave={() => setDragOverFolder(prev => prev === '__unfiled__' ? null : prev)}
            onDrop={e => onFolderDrop(e, null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors mb-1 w-full text-right ${
              selectedFolder === null ? 'bg-gray-800 dark:bg-gray-600 text-white'
              : dragOverFolder === '__unfiled__' ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <FolderOpen size={16} />
            <span className="flex-1">ללא תיקייה</span>
            <span className={`text-xs ${selectedFolder === null ? 'text-white/70' : 'text-gray-400'}`}>
              ({orders.filter(o => !o.folderId).length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5">
            {renderFolderTree()}
            {folders.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-4 px-2">עדיין אין תיקיות. לחץ על <span className="inline-block align-middle"><FolderPlus size={12} /></span> ליצירת תיקייה חדשה.</p>
            )}
          </div>
        </div>
      </div>

      {/* Main: Orders pane */}
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm h-full flex flex-col">
          {/* Header + Breadcrumbs */}
          <div className="p-5 border-b dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-1 flex-wrap">
                <span
                  onClick={() => setSelectedFolder(null)}
                  onDragOver={e => { e.preventDefault(); setDragOverFolder('__bc_unfiled__'); }}
                  onDragLeave={() => setDragOverFolder(prev => prev === '__bc_unfiled__' ? null : prev)}
                  onDrop={e => onFolderDrop(e, null)}
                  className={`cursor-pointer hover:text-blue-500 ${dragOverFolder === '__bc_unfiled__' ? 'text-blue-500 underline' : ''}`}
                >
                  תיקיות
                </span>
                {breadcrumbs.map((bc, i) => (
                  <React.Fragment key={bc.id}>
                    <ChevronLeft size={12} className="text-gray-300" />
                    <span
                      onClick={() => setSelectedFolder(bc.id)}
                      onDragOver={e => { e.preventDefault(); setDragOverFolder(bc.id + '_bc'); }}
                      onDragLeave={() => setDragOverFolder(prev => prev === bc.id + '_bc' ? null : prev)}
                      onDrop={e => onFolderDrop(e, bc.id)}
                      className={`cursor-pointer hover:text-blue-500 ${i === breadcrumbs.length - 1 ? 'text-gray-700 dark:text-gray-200 font-medium' : ''} ${dragOverFolder === bc.id + '_bc' ? 'text-blue-500 underline' : ''}`}
                      style={bc.color ? { color: bc.color } : {}}
                    >
                      {bc.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                {selectedFolder !== null && folders.find(f => f.id === selectedFolder)?.color && (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: folders.find(f => f.id === selectedFolder).color }} />
                )}
                {folderName}
              </h2>
              <p className="text-xs text-gray-400">{folderOrders.length} הזמנות</p>
            </div>

            {/* Bulk-move toolbar */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                <span className="text-sm text-blue-700 dark:text-blue-300">נבחרו {selectedCount}</span>
                <div className="relative">
                  <button
                    onClick={() => setBulkMoveOpen(v => !v)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-500 flex items-center gap-1"
                  >
                    <Move size={12} /> העבר לתיקייה
                  </button>
                  {bulkMoveOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[200px] max-h-64 overflow-y-auto">
                      <button
                        onClick={() => handleBulkMove(null)}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-200 border-b dark:border-gray-600"
                      >
                        ללא תיקייה
                      </button>
                      {buildFolderOptions().map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleBulkMove(f.id)}
                          className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-200"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedOrderIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">
                  בטל בחירה
                </button>
              </div>
            )}
          </div>

          {/* Orders table */}
          <div className="flex-1 overflow-y-auto">
            {folderOrders.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <FolderOpen size={40} className="mx-auto mb-3 opacity-50" />
                <p>אין הזמנות בתיקייה זו</p>
                <p className="text-xs text-gray-300 dark:text-gray-500 mt-1">גרור הזמנות מכאן לתיקיות בצד או השתמש בבחירה מרובה</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 sticky top-0">
                  <tr>
                    <th className="p-3 w-10">
                      <button onClick={toggleSelectAllVisible} className="text-gray-400 hover:text-gray-600" title={allVisibleSelected ? 'בטל בחירה' : 'בחר הכל'}>
                        {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="text-right p-3">מס' הזמנה</th>
                    <th className="text-right p-3">לקוח</th>
                    <th className="text-right p-3">חלק</th>
                    <th className="text-right p-3">תאריך</th>
                    <th className="text-right p-3">סטטוס</th>
                    <th className="p-3">פעולות</th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-300">
                  {folderOrders.map(order => {
                    const st = statusBadge(order.status);
                    const isSelected = selectedOrderIds.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        draggable
                        onDragStart={e => onOrderDragStart(e, order.id)}
                        className={`border-t dark:border-gray-700 cursor-grab active:cursor-grabbing ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => setSelectedOrderIds(prev => {
                              const next = new Set(prev);
                              next.has(order.id) ? next.delete(order.id) : next.add(order.id);
                              return next;
                            })}
                            className="w-4 h-4 accent-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-medium">{order.orderNumber}</td>
                        <td className="p-3">{order.customerName}</td>
                        <td className="p-3">{order.partName}</td>
                        <td className="p-3">{formatDate(order.date)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1.5 items-center">
                            <select
                              value={order.folderId || ''}
                              onChange={e => moveOrderTo(order.id, e.target.value || null)}
                              onClick={e => e.stopPropagation()}
                              className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1 text-xs outline-none"
                              title="העבר לתיקייה"
                            >
                              <option value="">ללא תיקייה</option>
                              {buildFolderOptions().map(f => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                              ))}
                            </select>
                            {order.reportPath && (
                              <a href={downloadReportUrl(order.id)} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white p-1.5 rounded hover:bg-green-500" title="הורד דוח">
                                <Download size={12} />
                              </a>
                            )}
                            {order.cocPath && (
                              <a href={downloadCOCUrl(order.id)} target="_blank" rel="noopener noreferrer" className="bg-purple-600 text-white p-1.5 rounded hover:bg-purple-500" title="הורד תעודת התאמה">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">מחיקת תיקייה</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              האם למחוק את תיקייה "<strong>{confirmDeleteFolder.name}</strong>"?
              <br />התיקייה תועבר לסל המחזור וניתן יהיה לשחזר אותה. ההזמנות שבתוכה יעברו ל-"ללא תיקייה" (ישוחזרו עם התיקייה אם לא הועברו ידנית בינתיים). תיקיות משנה יועברו לאב.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteFolder(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                ביטול
              </button>
              <button
                onClick={async () => {
                  await handleDeleteFolder(confirmDeleteFolder.id);
                  setConfirmDeleteFolder(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500"
              >
                העבר לסל המחזור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

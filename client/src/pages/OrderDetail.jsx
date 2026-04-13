import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchOrder, updateOrder, deleteOrder, deleteOrderFile,
  uploadDrawing, uploadCustomerOrder, uploadQualityDocs, removeQualityDoc,
  generateReport, generateCOC,
  downloadReportUrl, downloadCOCUrl,
} from '../utils/api';
import { statusBadge, formatDate } from '../utils/helpers';
import { useToast } from '../components/Toast';
import {
  Upload, FileSpreadsheet, Download, ArrowRight, Trash2, Save,
  FileText, FileImage, FolderOpen, Award, AlertTriangle, CheckCircle,
  Plus, X as XIcon,
} from 'lucide-react';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dims, setDims] = useState([]);
  const [rawMat, setRawMat] = useState({});
  const [uploading, setUploading] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatingCOC, setGeneratingCOC] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function loadOrder() {
    setLoading(true);
    const data = await fetchOrder(id);
    if (data.error) {
      toast.error(data.error);
      setLoading(false);
      return;
    }
    // Migrate old format
    if (!data.files) {
      data.files = {
        drawing: data.fileName ? { originalName: data.fileName, serverPath: data.filePath } : null,
        customerOrder: null,
        qualityDocs: [],
      };
    }
    if (!data.rawMaterial) {
      data.rawMaterial = {};
    }
    setOrder(data);
    setDims(data.dimensions || []);
    setRawMat(data.rawMaterial || {});
    setLoading(false);
  }

  // ─── File Uploads ────────────────────────────────────────────────
  async function handleUploadDrawing(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(prev => ({ ...prev, drawing: true }));
    const result = await uploadDrawing(id, file);
    setUploading(prev => ({ ...prev, drawing: false }));
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success(`שרטוט "${file.name}" הועלה בהצלחה`);
  }

  async function handleUploadCustomerOrder(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(prev => ({ ...prev, customerOrder: true }));
    const result = await uploadCustomerOrder(id, file);
    setUploading(prev => ({ ...prev, customerOrder: false }));
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success(`הזמנת לקוח "${file.name}" הועלה בהצלחה`);
  }

  async function handleUploadQualityDocs(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(prev => ({ ...prev, quality: true }));
    const result = await uploadQualityDocs(id, files);
    setUploading(prev => ({ ...prev, quality: false }));
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success(`${files.length} מסמכי איכות הועלו בהצלחה`);
  }

  async function handleRemoveQualityDoc(idx) {
    const result = await removeQualityDoc(id, idx);
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.info('מסמך הוסר');
  }

  // ─── Dimensions ──────────────────────────────────────────────────
  function updateDim(idx, field, value) {
    setDims(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function addDim() {
    setDims(prev => [...prev, { symbol: '', nominal: '', tolerance: '', min: '', max: '', remarks: '', flaggedForReview: false }]);
  }

  function removeDim(idx) {
    setDims(prev => prev.filter((_, i) => i !== idx));
  }

  // ─── Raw Material ────────────────────────────────────────────────
  function updateRawMat(field, value) {
    setRawMat(prev => ({ ...prev, [field]: value }));
  }

  // ─── Save (without generating) ──────────────────────────────────
  async function handleSave() {
    const result = await updateOrder(id, { dimensions: dims, rawMaterial: rawMat });
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success('הנתונים נשמרו בהצלחה');
  }

  // ─── Generate Report ─────────────────────────────────────────────
  async function handleGenerate() {
    if (dims.length === 0) {
      toast.warning('אנא הוסף מידות לפני יצירת דוח');
      return;
    }
    setGenerating(true);
    const result = await generateReport(id, dims, rawMat);
    setGenerating(false);
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success('דוח Excel נוצר בהצלחה — כולל גיליון מידות וחומר גלם');
  }

  // ─── Generate C.O.C. ─────────────────────────────────────────────
  async function handleGenerateCOC() {
    setGeneratingCOC(true);
    const result = await generateCOC(id);
    setGeneratingCOC(false);
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success('תעודת התאמה (C.O.C.) נוצרה בהצלחה');
  }

  // ─── Delete ──────────────────────────────────────────────────────
  async function handleDelete() {
    const result = await deleteOrder(id);
    if (result.error) { toast.error(result.error); return; }
    toast.success('ההזמנה הועברה לסל המחזור');
    navigate('/orders');
  }

  // ─── Delete individual file ─────────────────────────────────────
  async function handleDeleteFile(fileType, label) {
    const result = await deleteOrderFile(id, fileType);
    if (result.error) { toast.error(result.error); return; }
    setOrder(result);
    toast.success(`${label} נמחק בהצלחה`);
  }

  // ─── Render ──────────────────────────────────────────────────────
  if (loading) return <div className="p-8 text-gray-400">טוען...</div>;
  if (!order) return <div className="p-8 text-red-500">הזמנה לא נמצאה</div>;

  const st = statusBadge(order.status);
  const files = order.files || { drawing: null, customerOrder: null, qualityDocs: [] };

  const tabs = [
    { key: 'documents', label: 'מסמכים', icon: FolderOpen },
    { key: 'dimensions', label: 'טבלת מידות', icon: FileSpreadsheet },
    { key: 'rawMaterial', label: 'חומר גלם', icon: FileText },
    { key: 'generate', label: 'יצירת דוחות', icon: Award },
  ];

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <Link to="/orders" className="flex items-center gap-1 text-sm text-blue-500 hover:underline mb-4">
        <ArrowRight size={14} /> חזרה למאגר הזמנות
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{order.orderNumber}</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${st.class}`}>{st.label}</span>
        </div>
        <button
          onClick={() => setShowDelete(true)}
          className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1"
        >
          <Trash2 size={14} /> מחק הזמנה
        </button>
      </div>

      {/* Order Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">פרטי הזמנה</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm dark:text-gray-300">
          {[
            ['לקוח', order.customerName],
            ['שם החלק', order.partName],
            ["מס' שרטוט", order.drawingNumber],
            ['מהדורה', order.revision],
            ['מק"ט', order.sku],
            ['כמות', order.quantity],
            ['כמות מדגם', order.sampleQuantity],
            ['תוכנית דגימה', order.samplingPlan],
            ['חומר', order.material],
            ['תאריך', formatDate(order.date)],
          ].map(([label, val]) => (
            <div key={label}>
              <span className="text-gray-500 dark:text-gray-400">{label}: </span>
              <span className="font-medium">{val || '—'}</span>
            </div>
          ))}
        </div>
        {order.notes && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">{order.notes}</p>}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: Documents ═══ */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Drawing Upload */}
          <FileUploadCard
            title="שרטוט טכני"
            icon={<FileImage size={20} className="text-blue-500" />}
            file={files.drawing}
            uploading={uploading.drawing}
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
            onChange={handleUploadDrawing}
            hint="PDF / תמונה"
            onDelete={files.drawing ? () => handleDeleteFile('drawing', 'שרטוט') : null}
          />

          {/* Customer Order Upload */}
          <FileUploadCard
            title="הזמנת לקוח"
            icon={<FileText size={20} className="text-green-500" />}
            file={files.customerOrder}
            uploading={uploading.customerOrder}
            accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg"
            onChange={handleUploadCustomerOrder}
            hint="PDF / Excel / Word / תמונה"
            onDelete={files.customerOrder ? () => handleDeleteFile('customerOrder', 'הזמנת לקוח') : null}
          />

          {/* Quality Docs Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen size={20} className="text-purple-500" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">מסמכי איכות</h3>
            </div>

            {(files.qualityDocs || []).length > 0 && (
              <div className="space-y-2 mb-4">
                {files.qualityDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-lg text-sm dark:text-gray-300">
                    <span>{doc.originalName}</span>
                    <button
                      onClick={() => handleRemoveQualityDoc(idx)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-900/20 transition-colors text-sm text-gray-500 dark:text-gray-400">
              <Upload size={16} />
              {uploading.quality ? 'מעלה...' : 'לחץ להעלאת מסמכי איכות (ניתן לבחור מספר קבצים)'}
              <input type="file" className="hidden" multiple accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg" onChange={handleUploadQualityDocs} />
            </label>
          </div>
        </div>
      )}

      {/* ═══ TAB: Dimensions ═══ */}
      {activeTab === 'dimensions' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">טבלת מידות</h2>
            <div className="flex gap-2">
              <button onClick={addDim} className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <Plus size={14} /> הוסף שורה
              </button>
              <button onClick={handleSave} className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <Save size={14} /> שמור
              </button>
            </div>
          </div>

          {dims.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 mb-2">אין מידות — הוסף שורות ידנית</p>
              <p className="text-xs text-gray-300 dark:text-gray-500">המערכת לא ממציאה נתונים. יש להזין מידות מהשרטוט או מהזמנת הלקוח.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 dark:bg-gray-700 text-white">
                  <tr>
                    <th className="p-2 text-right w-10">#</th>
                    <th className="p-2 text-right">סוג מידה / סימול</th>
                    <th className="p-2 text-right">מידה נומינלית</th>
                    <th className="p-2 text-right">טולרנס</th>
                    <th className="p-2 text-right">מינימום</th>
                    <th className="p-2 text-right">מקסימום</th>
                    <th className="p-2 text-right">הערות</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-300">
                  {dims.map((dim, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'} ${dim.flaggedForReview ? 'ring-1 ring-yellow-400' : ''}`}>
                      <td className="p-2 text-gray-400">{idx + 1}</td>
                      {['symbol', 'nominal', 'tolerance', 'min', 'max', 'remarks'].map(field => (
                        <td key={field} className="p-1">
                          <input
                            type={['nominal', 'min', 'max'].includes(field) ? 'number' : 'text'}
                            step="any"
                            value={dim[field] ?? ''}
                            onChange={e => updateDim(idx, field, e.target.value)}
                            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 outline-none"
                          />
                        </td>
                      ))}
                      <td className="p-1">
                        <button onClick={() => removeDim(idx)} className="text-red-400 hover:text-red-600 text-xs px-2">
                          <XIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dims.some(d => d.flaggedForReview) && (
            <div className="mt-4 flex items-center gap-2 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 px-4 py-2 rounded-lg text-sm">
              <AlertTriangle size={16} />
              <span>שורות מסומנות בצהוב דורשות אימות ידני — נא לבדוק את הנתונים</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Raw Material ═══ */}
      {activeTab === 'rawMaterial' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">פרטי חומר גלם</h2>
            <button onClick={handleSave} className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <Save size={14} /> שמור
            </button>
          </div>

          <p className="text-xs text-gray-400 mb-4">
            הזן פרטי חומר גלם מהשרטוט או מהמסמכים שהועלו. המערכת לא ממלאת שדות שלא סופקו.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'materialType', label: 'סוג חומר', placeholder: 'לדוגמה: NBR, EPDM, Silicone' },
              { key: 'description', label: 'תיאור חומר', placeholder: 'תיאור מלא' },
              { key: 'supplier', label: 'ספק', placeholder: 'שם הספק' },
              { key: 'batchNumber', label: "מס' אצווה", placeholder: '' },
              { key: 'certNumber', label: "מס' תעודה", placeholder: '' },
              { key: 'hardness', label: 'קשיות', placeholder: 'לדוגמה: 70 Shore A' },
              { key: 'color', label: 'צבע', placeholder: '' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input
                  type="text"
                  value={rawMat[key] || ''}
                  onChange={e => updateRawMat(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">הערות חומר</label>
              <textarea
                value={rawMat.notes || ''}
                onChange={e => updateRawMat('notes', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {order.material && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 px-4 py-3 rounded-lg text-sm">
              <span className="text-blue-600 dark:text-blue-400 font-medium">חומר מוגדר בהזמנה: </span>
              <span className="text-blue-800 dark:text-blue-300">{order.material}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Generate ═══ */}
      {activeTab === 'generate' && (
        <div className="space-y-4">
          {/* Pre-generation checklist */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">בדיקת מוכנות</h2>
            <div className="space-y-2">
              <CheckItem ok={!!files.drawing} label="שרטוט טכני הועלה" />
              <CheckItem ok={!!files.customerOrder} label="הזמנת לקוח הועלה" />
              <CheckItem ok={dims.length > 0} label="טבלת מידות מוזנת" />
              <CheckItem ok={!!(rawMat.materialType || order.material)} label="חומר גלם מוגדר" />
            </div>
          </div>

          {/* Approve Order */}
          {(order.status === 'pending_review' || order.status === 'new' || order.status === 'drawing_uploaded') && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">אישור הזמנה</h3>
              <p className="text-xs text-gray-400 mb-4">
                לאחר בדיקת כל הנתונים — אשר את ההזמנה לפני יצירת דוחות.
              </p>
              <button
                onClick={async () => {
                  const result = await updateOrder(id, {
                    status: 'approved',
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: 'manager',
                  });
                  if (result.error) { toast.error(result.error); return; }
                  setOrder(result);
                  toast.success('ההזמנה אושרה');
                }}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
              >
                <CheckCircle size={16} />
                אשר הזמנה
              </button>
            </div>
          )}

          {/* Generate Excel Report */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">דוח Excel (מידות + חומר גלם)</h3>
            <p className="text-xs text-gray-400 mb-4">
              יצור קובץ Excel עם שני גיליונות: דוח מידות וגיליון חומר גלם. כל הנתונים מבוססים אך ורק על מה שהוזן.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={generating || dims.length === 0}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                <FileSpreadsheet size={16} />
                {generating ? 'מייצר דוח...' : 'צור דוח Excel'}
              </button>
              {order.reportPath && (
                <>
                  <a
                    href={downloadReportUrl(id)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
                  >
                    <Download size={16} />
                    הורד דוח
                  </a>
                  <button
                    onClick={() => handleDeleteFile('report', 'דוח Excel')}
                    className="flex items-center gap-1 text-red-400 hover:text-red-600 text-sm"
                  >
                    <Trash2 size={14} /> מחק דוח
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Generate C.O.C. as DOCX */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">תעודת התאמה (C.O.C.) — Word</h3>
            <p className="text-xs text-gray-400 mb-4">
              תעודת התאמה / הצהרת יצרן בפורמט Word (.docx), מקושרת להזמנה, לשרטוט, לדוח המידות ולחומר הגלם.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleGenerateCOC}
                disabled={generatingCOC}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
              >
                <Award size={16} />
                {generatingCOC ? 'מייצר תעודה...' : 'צור תעודת התאמה (Word)'}
              </button>
              {order.cocPath && (
                <>
                  <a
                    href={downloadCOCUrl(id)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
                  >
                    <Download size={16} />
                    הורד תעודת התאמה
                  </a>
                  <button
                    onClick={() => handleDeleteFile('coc', 'תעודת התאמה')}
                    className="flex items-center gap-1 text-red-400 hover:text-red-600 text-sm"
                  >
                    <Trash2 size={14} /> מחק תעודה
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">מחיקת הזמנה</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              האם למחוק את הזמנה <strong>{order.orderNumber}</strong>?
              <br />ההזמנה תועבר לסל המחזור וניתן יהיה לשחזר אותה.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                ביטול
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500">
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function FileUploadCard({ title, icon, file, uploading, accept, onChange, hint, onDelete }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      </div>

      {file ? (
        <div className="flex items-center gap-3">
          <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle size={14} />
            <strong>{file.originalName}</strong>
          </div>
          <label className="cursor-pointer text-sm text-blue-500 hover:underline">
            החלף קובץ
            <input type="file" className="hidden" accept={accept} onChange={onChange} />
          </label>
          {onDelete && (
            <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1">
              <Trash2 size={12} /> מחק
            </button>
          )}
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
          <Upload size={28} className="text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {uploading ? 'מעלה...' : `לחץ כאן להעלאת ${title} (${hint})`}
          </span>
          <input type="file" className="hidden" accept={accept} onChange={onChange} />
        </label>
      )}
    </div>
  );
}

function CheckItem({ ok, label }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${ok ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-400'}`}>
      {ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {label}
    </div>
  );
}

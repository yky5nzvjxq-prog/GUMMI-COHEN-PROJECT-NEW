import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder, fetchFolders, tempUpload, extractOrderData } from '../utils/api';
import { useToast } from '../components/Toast';
import {
  Upload, FileImage, FileText, FolderOpen, ChevronLeft, ChevronRight,
  CheckCircle, AlertTriangle, Shield, X as XIcon, Loader2, Zap,
} from 'lucide-react';

const STEPS = [
  { key: 'upload', label: 'העלאת קבצים', icon: Upload },
  { key: 'details', label: 'פרטי הזמנה', icon: FileText },
  { key: 'review', label: 'סקירה ובדיקה', icon: Shield },
  { key: 'approve', label: 'אישור', icon: CheckCircle },
];

const EMPTY_FORM = {
  customerName: '', orderNumber: '', drawingNumber: '', revision: '', partName: '',
  sku: '', quantity: '', sampleQuantity: '', samplingPlan: '',
  material: '', date: new Date().toISOString().slice(0, 10), notes: '', folderId: '',
};

export default function NewOrder() {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState({ drawing: null, customerOrder: null, qualityDocs: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [folders, setFolders] = useState([]);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);
  // Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState({}); // { fieldKey: 'high' | 'low' }

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchFolders().then(data => { if (Array.isArray(data)) setFolders(data); });
  }, []);

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: null }));
    // Clear extraction badge when user manually edits
    if (extractedFields[k]) {
      setExtractedFields(prev => {
        const copy = { ...prev };
        delete copy[k];
        return copy;
      });
    }
  };

  // ─── File Upload Handlers ────────────────────────────────────────
  async function handleFileUpload(type, e) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (type === 'qualityDocs') {
      setUploading(prev => ({ ...prev, quality: true }));
      const results = [];
      for (const file of Array.from(fileList)) {
        const result = await tempUpload(file);
        if (result.error) { toast.error(result.error); continue; }
        results.push(result);
      }
      setFiles(prev => ({ ...prev, qualityDocs: [...prev.qualityDocs, ...results] }));
      setUploading(prev => ({ ...prev, quality: false }));
      if (results.length > 0) toast.success(`${results.length} קבצים הועלו`);
    } else {
      setUploading(prev => ({ ...prev, [type]: true }));
      const file = fileList[0];
      const result = await tempUpload(file);
      setUploading(prev => ({ ...prev, [type]: false }));
      if (result.error) { toast.error(result.error); return; }
      setFiles(prev => ({ ...prev, [type]: result }));
      toast.success(`"${file.name}" הועלה בהצלחה`);

      // Auto-extract from customer order or drawing (PDF, Excel, Word)
      if (type === 'customerOrder' || type === 'drawing') {
        await runExtraction(result.serverPath);
      }
    }
    e.target.value = '';
  }

  // ─── PDF Extraction ──────────────────────────────────────────────
  async function runExtraction(filePath) {
    setExtracting(true);
    const result = await extractOrderData(filePath);
    setExtracting(false);

    if (result.error) {
      toast.info(result.error + ' — נא למלא ידנית');
      return;
    }

    const { extracted, confidence } = result;
    if (!extracted || Object.keys(extracted).length === 0) {
      toast.info('לא נמצאו נתונים בקובץ — נא למלא ידנית');
      return;
    }

    // Populate form with extracted values (only non-empty, only if form field is currently empty)
    const newForm = { ...form };
    const newExtracted = {};
    let count = 0;

    for (const [key, value] of Object.entries(extracted)) {
      if (value && key in EMPTY_FORM) {
        newForm[key] = String(value);
        newExtracted[key] = confidence[key] || 'low';
        count++;
      }
    }

    setForm(prev => {
      const merged = { ...prev };
      for (const [key, value] of Object.entries(extracted)) {
        if (value && key in EMPTY_FORM) {
          merged[key] = String(value);
        }
      }
      return merged;
    });
    setExtractedFields(newExtracted);
    toast.success(`${count} שדות חולצו אוטומטית מהזמנת הלקוח`);
  }

  function removeQualityDoc(idx) {
    setFiles(prev => ({ ...prev, qualityDocs: prev.qualityDocs.filter((_, i) => i !== idx) }));
  }

  // ─── Validation ──────────────────────────────────────────────────
  function validateDetails() {
    const errs = {};
    if (!form.customerName.trim()) errs.customerName = 'שדה חובה';
    if (!form.orderNumber.trim()) errs.orderNumber = 'שדה חובה';
    if (!form.partName.trim()) errs.partName = 'שדה חובה';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (step === 1 && !validateDetails()) {
      toast.warning('נא למלא את כל שדות החובה');
      return;
    }
    setStep(prev => Math.min(prev + 1, 3));
  }

  function goBack() {
    setStep(prev => Math.max(prev - 1, 0));
  }

  // ─── Submit ──────────────────────────────────────────────────────
  async function handleApprove() {
    setSaving(true);
    const result = await createOrder({
      ...form,
      quantity: Number(form.quantity) || 0,
      sampleQuantity: Number(form.sampleQuantity) || 0,
      folderId: form.folderId || null,
      status: 'pending_review',
      tempFiles: {
        drawing: files.drawing,
        customerOrder: files.customerOrder,
        qualityDocs: files.qualityDocs,
      },
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('ההזמנה נוצרה בהצלחה — ממתינה לאישור');
    navigate(`/orders/${result.id}`);
  }

  // ─── Build folder options with hierarchy ──────────────────────────
  function buildFolderOptions(parentId = null, depth = 0) {
    return folders
      .filter(f => f.parentId === parentId)
      .flatMap(f => [
        { id: f.id, label: '\u00A0\u00A0'.repeat(depth) + f.name },
        ...buildFolderOptions(f.id, depth + 1),
      ]);
  }

  // ─── Extraction badge helper ──────────────────────────────────────
  function ExtractionBadge({ fieldKey }) {
    const level = extractedFields[fieldKey];
    if (!level) return null;
    if (level === 'high') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mr-1">
          <Zap size={9} /> חולץ מהקובץ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full mr-1">
        <AlertTriangle size={9} /> דורש בדיקה
      </span>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────
  const extractedCount = Object.keys(extractedFields).length;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-navy-600 mb-6">הזמנה חדשה</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && <div className={`flex-1 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />}
              <button
                onClick={() => { if (isDone) setStep(i); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-navy-600 text-white' : isDone ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Icon size={16} />
                {s.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* ═══ Step 1: Upload Files ═══ */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">
            העלה את המסמכים הרלוונטיים. העלאת הזמנת לקוח או שרטוט (PDF / Excel / Word) תחלץ אוטומטית את פרטי ההזמנה.
          </p>

          <UploadZone
            title="שרטוט טכני"
            icon={<FileImage size={20} className="text-blue-500" />}
            file={files.drawing}
            uploading={uploading.drawing}
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff"
            onChange={e => handleFileUpload('drawing', e)}
            onRemove={() => setFiles(prev => ({ ...prev, drawing: null }))}
          />

          {/* Customer Order — with extraction indicator */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText size={20} className="text-green-500" />
              <h3 className="font-semibold text-navy-600">הזמנת לקוח</h3>
              {extracting && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full animate-pulse">
                  <Loader2 size={12} className="animate-spin" />
                  מחלץ נתונים...
                </span>
              )}
              {!extracting && extractedCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                  <Zap size={12} />
                  {extractedCount} שדות חולצו
                </span>
              )}
            </div>

            {files.customerOrder ? (
              <div className="flex items-center gap-3">
                <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle size={14} />
                  <strong>{files.customerOrder.originalName}</strong>
                </div>
                <button
                  onClick={() => {
                    setFiles(prev => ({ ...prev, customerOrder: null }));
                    setExtractedFields({});
                    setForm(EMPTY_FORM);
                  }}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  הסר
                </button>
                <label className="cursor-pointer text-sm text-blue-500 hover:underline">
                  החלף
                  <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg" onChange={e => handleFileUpload('customerOrder', e)} />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors">
                <Upload size={28} className="text-gray-400" />
                <span className="text-sm text-gray-500">
                  {uploading.customerOrder ? 'מעלה...' : 'לחץ להעלאת הזמנת לקוח (PDF / Excel / Word — חילוץ אוטומטי)'}
                </span>
                <span className="text-[11px] text-gray-400">נתוני ההזמנה יחולצו אוטומטית מ-PDF, Excel או Word</span>
                <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg" onChange={e => handleFileUpload('customerOrder', e)} />
              </label>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen size={20} className="text-purple-500" />
              <h3 className="font-semibold text-navy-600">מסמכי איכות</h3>
            </div>
            {files.qualityDocs.length > 0 && (
              <div className="space-y-2 mb-4">
                {files.qualityDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg text-sm">
                    <span>{doc.originalName}</span>
                    <button onClick={() => removeQualityDoc(idx)} className="text-red-400 hover:text-red-600"><XIcon size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors text-sm text-gray-500">
              <Upload size={16} />
              {uploading.quality ? 'מעלה...' : 'לחץ להעלאת מסמכי איכות (מספר קבצים)'}
              <input type="file" className="hidden" multiple accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg" onChange={e => handleFileUpload('qualityDocs', e)} />
            </label>
          </div>

          {/* Extraction summary */}
          {extractedCount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <Zap size={16} />
              <span><strong>{extractedCount} שדות</strong> חולצו אוטומטית מהזמנת הלקוח. המשך לשלב הבא לסקירה ועריכה.</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ Step 2: Order Details ═══ */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          {extractedCount > 0 && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 flex items-center gap-2">
              <Zap size={14} />
              <span>שדות מסומנים ב<span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1 py-0.5 rounded text-[10px] mx-0.5"><Zap size={8} />חולץ מהקובץ</span> חולצו אוטומטית. ניתן לערוך כל שדה.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'customerName', label: 'שם לקוח', required: true },
              { key: 'orderNumber', label: "מס' הזמנה", required: true },
              { key: 'drawingNumber', label: "מס' שרטוט / אופיון" },
              { key: 'revision', label: 'מהדורה / גרסה', placeholder: 'Rev A' },
              { key: 'partName', label: 'שם החלק / תיאור', required: true },
              { key: 'sku', label: 'מק"ט' },
              { key: 'quantity', label: 'כמות בהזמנה', type: 'number' },
              { key: 'sampleQuantity', label: 'כמות במדגם', type: 'number' },
              { key: 'samplingPlan', label: 'תוכנית דגימה', placeholder: 'MIL-STD-1916 Level I' },
              { key: 'material', label: 'חומר', placeholder: 'NBR 70 Shore A' },
              { key: 'date', label: 'תאריך', type: 'date' },
            ].map(({ key, label, type = 'text', required, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label} {required && <span className="text-red-400">*</span>}
                  <ExtractionBadge fieldKey={key} />
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none ${
                    errors[key] ? 'border-red-400 bg-red-50'
                    : extractedFields[key] ? 'border-green-300 bg-green-50/50'
                    : 'border-gray-300'
                  }`}
                />
                {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
              </div>
            ))}

            {/* Folder selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תיקייה</label>
              <select
                value={form.folderId}
                onChange={e => set('folderId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="">ללא תיקייה</option>
                {buildFolderOptions().map(f => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            />
          </div>
        </div>
      )}

      {/* ═══ Step 3: Review ═══ */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Order Details Review */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-navy-600">פרטי הזמנה</h3>
              <button onClick={() => setStep(1)} className="text-xs text-blue-500 hover:underline">ערוך</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              {[
                ['לקוח', form.customerName, true, 'customerName'],
                ["מס' הזמנה", form.orderNumber, true, 'orderNumber'],
                ["מס' שרטוט", form.drawingNumber, false, 'drawingNumber'],
                ['מהדורה', form.revision, false, 'revision'],
                ['שם החלק', form.partName, true, 'partName'],
                ['מק"ט', form.sku, false, 'sku'],
                ['כמות', form.quantity, false, 'quantity'],
                ['כמות מדגם', form.sampleQuantity, false, 'sampleQuantity'],
                ['תוכנית דגימה', form.samplingPlan, false, 'samplingPlan'],
                ['חומר', form.material, false, 'material'],
                ['תאריך', form.date, false, 'date'],
              ].map(([label, val, required, fieldKey]) => (
                <div key={label}>
                  <span className="text-gray-500">{label}: </span>
                  {val ? (
                    <span className="font-medium">
                      {val}
                      {extractedFields[fieldKey] && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] bg-green-100 text-green-600 px-1 py-0.5 rounded mr-1">
                          <Zap size={7} />
                        </span>
                      )}
                    </span>
                  ) : required ? (
                    <span className="text-red-400 font-medium">חסר</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Files Review */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-navy-600">מסמכים שהועלו</h3>
              <button onClick={() => setStep(0)} className="text-xs text-blue-500 hover:underline">ערוך</button>
            </div>
            <div className="space-y-2 text-sm">
              <FileStatus label="שרטוט טכני" file={files.drawing} />
              <FileStatus label="הזמנת לקוח" file={files.customerOrder} extracted={extractedCount > 0} />
              <FileStatus
                label="מסמכי איכות"
                file={files.qualityDocs.length > 0 ? { originalName: `${files.qualityDocs.length} קבצים` } : null}
              />
            </div>
          </div>

          {form.notes && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-navy-600 mb-2">הערות</h3>
              <p className="text-sm text-gray-600">{form.notes}</p>
            </div>
          )}

          {(!form.customerName || !form.orderNumber || !form.partName) && (
            <div className="flex items-center gap-2 text-orange-700 bg-orange-50 px-4 py-3 rounded-lg text-sm">
              <AlertTriangle size={16} />
              <span>שדות חובה חסרים — לא ניתן לאשר. חזור לשלב הקודם להשלמה.</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ Step 4: Approve ═══ */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-navy-600 mb-2">סקירה הושלמה</h2>
          <p className="text-sm text-gray-500 mb-6">
            כל הנתונים הוזנו ונבדקו. לחץ "אשר ושמור" ליצירת ההזמנה.
            <br />
            ההזמנה תישמר עם סטטוס "ממתין לאישור".
          </p>
          <button
            onClick={handleApprove}
            disabled={saving || !form.customerName || !form.orderNumber || !form.partName}
            className="bg-green-600 text-white px-8 py-3 rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'שומר...' : 'אשר ושמור הזמנה'}
          </button>
        </div>
      )}

      {/* Navigation Buttons */}
      {step < 3 && (
        <div className="flex justify-between mt-6">
          <button
            onClick={goBack}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronRight size={16} /> הקודם
          </button>
          <button
            onClick={goNext}
            disabled={extracting}
            className="flex items-center gap-1 bg-navy-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-navy-500 disabled:opacity-50 transition-colors"
          >
            {extracting ? (
              <><Loader2 size={14} className="animate-spin" /> מחלץ נתונים...</>
            ) : (
              <>הבא <ChevronLeft size={16} /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function UploadZone({ title, icon, file, uploading, accept, onChange, onRemove }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h3 className="font-semibold text-navy-600">{title}</h3>
      </div>
      {file ? (
        <div className="flex items-center gap-3">
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle size={14} />
            <strong>{file.originalName}</strong>
          </div>
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-sm">הסר</button>
          <label className="cursor-pointer text-sm text-blue-500 hover:underline">
            החלף
            <input type="file" className="hidden" accept={accept} onChange={onChange} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
          <Upload size={28} className="text-gray-400" />
          <span className="text-sm text-gray-500">{uploading ? 'מעלה...' : `לחץ להעלאת ${title}`}</span>
          <input type="file" className="hidden" accept={accept} onChange={onChange} />
        </label>
      )}
    </div>
  );
}

function FileStatus({ label, file, extracted }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${file ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
      {file ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span>{label}: </span>
      <span className="font-medium">{file ? file.originalName : 'לא הועלה'}</span>
      {extracted && (
        <span className="flex items-center gap-1 text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">
          <Zap size={9} /> נתונים חולצו
        </span>
      )}
    </div>
  );
}

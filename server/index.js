const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateExcelReport } = require('./excelGenerator');
const { generateCOCDocx } = require('./docxGenerator');
const { extractOrderData } = require('./orderExtractor');
const { extractDocumentDataFull } = require('./extractionPipeline');
const { initOCR, terminateOCR } = require('./ocrEngine');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// Ensure directories exist
['uploads', 'reports', 'data'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ─── JSON File Persistence ───────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'orders.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const FOLDERS_FILE = path.join(__dirname, 'data', 'folders.json');
const TRASH_FILE = path.join(__dirname, 'data', 'trash.json');

function loadJSON(filepath, fallback) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error loading ${filepath}:`, err.message);
  }
  return fallback;
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

const orders = loadJSON(DATA_FILE, []);
let settings = loadJSON(SETTINGS_FILE, {
  factoryName: 'מפעל גומי',
  managerName: '',
  defaultSamplingPlan: '',
  commonMaterials: [],
});
const folders = loadJSON(FOLDERS_FILE, []);
const trash = loadJSON(TRASH_FILE, []);

function saveOrders() { saveJSON(DATA_FILE, orders); }
function saveSettings(data) { saveJSON(SETTINGS_FILE, data); }
function saveFolders() { saveJSON(FOLDERS_FILE, folders); }
function saveTrash() { saveJSON(TRASH_FILE, trash); }

// ─── File Upload Config ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.xls', '.xlsx', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`סוג קובץ לא נתמך: ${ext}`));
    }
  }
});

// ─── SETTINGS API ────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  settings = { ...settings, ...req.body };
  saveSettings(settings);
  res.json(settings);
});

// ─── FOLDERS API ─────────────────────────────────────────────────────

app.get('/api/folders', (req, res) => {
  res.json([...folders].sort((a, b) => a.name.localeCompare(b.name, 'he')));
});

app.post('/api/folders', (req, res) => {
  const { name, parentId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'שם תיקייה הוא שדה חובה' });
  }
  if (parentId && !folders.find(f => f.id === parentId)) {
    return res.status(400).json({ error: 'תיקיית אב לא נמצאה' });
  }
  const folder = {
    id: uuidv4(),
    name: name.trim(),
    parentId: parentId || null,
    createdAt: new Date().toISOString(),
  };
  folders.push(folder);
  saveFolders();
  res.status(201).json(folder);
});

app.put('/api/folders/:id', (req, res) => {
  const idx = folders.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'תיקייה לא נמצאה' });

  const { name, parentId } = req.body;

  // Validate no circular reference
  if (parentId !== undefined) {
    if (parentId === req.params.id) {
      return res.status(400).json({ error: 'תיקייה לא יכולה להיות אב של עצמה' });
    }
    // Check ancestors to prevent cycles
    let current = parentId;
    while (current) {
      const parent = folders.find(f => f.id === current);
      if (!parent) break;
      if (parent.id === req.params.id) {
        return res.status(400).json({ error: 'לא ניתן ליצור מעגל בהיררכיית תיקיות' });
      }
      current = parent.parentId;
    }
    folders[idx].parentId = parentId || null;
  }
  if (name !== undefined) {
    folders[idx].name = name.trim();
  }
  saveFolders();
  res.json(folders[idx]);
});

app.delete('/api/folders/:id', (req, res) => {
  const idx = folders.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'תיקייה לא נמצאה' });

  const deletedFolder = folders[idx];

  // Re-parent children to the deleted folder's parent
  folders.forEach(f => {
    if (f.parentId === deletedFolder.id) {
      f.parentId = deletedFolder.parentId;
    }
  });

  // Clear folderId on affected orders
  orders.forEach(o => {
    if (o.folderId === deletedFolder.id) {
      o.folderId = null;
    }
  });

  folders.splice(idx, 1);
  saveFolders();
  saveOrders();
  res.json({ success: true });
});

// ─── ORDERS API ──────────────────────────────────────────────────────

// GET all orders
app.get('/api/orders', (req, res) => {
  const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});

// GET single order
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
  res.json(order);
});

// GET dashboard stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalOrders: orders.length,
    newDrawings: orders.filter(o => o.status === 'drawing_uploaded').length,
    reportsGenerated: orders.filter(o => ['report_generated', 'reviewed'].includes(o.status)).length,
    awaitingReview: orders.filter(o => o.status === 'report_generated').length,
    newOrders: orders.filter(o => o.status === 'new').length,
    pendingReview: orders.filter(o => o.status === 'pending_review').length,
    approved: orders.filter(o => o.status === 'approved').length,
  });
});

// CREATE order (supports wizard flow with tempFiles)
app.post('/api/orders', (req, res) => {
  const { customerName, orderNumber, partName } = req.body;

  // Validate required fields
  const missing = [];
  if (!customerName || !customerName.trim()) missing.push('שם לקוח');
  if (!orderNumber || !orderNumber.trim()) missing.push("מס' הזמנה");
  if (!partName || !partName.trim()) missing.push('שם החלק');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `שדות חובה חסרים: ${missing.join(', ')}`
    });
  }

  // Build files from tempFiles if provided (wizard flow)
  const tempFiles = req.body.tempFiles;
  let files;
  if (tempFiles) {
    files = {
      drawing: tempFiles.drawing ? {
        originalName: tempFiles.drawing.originalName,
        serverPath: tempFiles.drawing.serverPath,
        uploadedAt: new Date().toISOString(),
      } : null,
      customerOrder: tempFiles.customerOrder ? {
        originalName: tempFiles.customerOrder.originalName,
        serverPath: tempFiles.customerOrder.serverPath,
        uploadedAt: new Date().toISOString(),
      } : null,
      qualityDocs: (tempFiles.qualityDocs || []).map(f => ({
        originalName: f.originalName,
        serverPath: f.serverPath,
        uploadedAt: new Date().toISOString(),
      })),
    };
  } else {
    files = { drawing: null, customerOrder: null, qualityDocs: [] };
  }

  const order = {
    id: uuidv4(),
    customerName: req.body.customerName?.trim() || '',
    orderNumber: req.body.orderNumber?.trim() || '',
    drawingNumber: req.body.drawingNumber?.trim() || '',
    revision: req.body.revision?.trim() || '',
    partName: req.body.partName?.trim() || '',
    sku: req.body.sku?.trim() || '',
    quantity: Number(req.body.quantity) || 0,
    sampleQuantity: Number(req.body.sampleQuantity) || 0,
    samplingPlan: req.body.samplingPlan?.trim() || '',
    material: req.body.material?.trim() || '',
    materialDescription: req.body.materialDescription?.trim() || '',
    date: req.body.date || new Date().toISOString().slice(0, 10),
    notes: req.body.notes?.trim() || '',
    status: req.body.status || 'new',
    folderId: req.body.folderId || null,
    files,
    dimensions: [],
    rawMaterial: {
      materialType: '',
      description: '',
      supplier: '',
      batchNumber: '',
      certNumber: '',
      hardness: '',
      color: '',
      notes: '',
      flaggedForReview: false,
    },
    reportPath: null,
    cocPath: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  orders.push(order);
  saveOrders();
  res.status(201).json(order);
});

// UPDATE order
app.put('/api/orders/:id', (req, res) => {
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  const { id, createdAt, ...updateData } = req.body;
  orders[idx] = { ...orders[idx], ...updateData, updatedAt: new Date().toISOString() };
  saveOrders();
  res.json(orders[idx]);
});

// SOFT DELETE order (move to trash)
app.delete('/api/orders/:id', (req, res) => {
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  const order = orders.splice(idx, 1)[0];
  order.deletedAt = new Date().toISOString();
  trash.push(order);
  saveOrders();
  saveTrash();
  res.json({ success: true });
});

// DELETE individual file from order (drawing, customerOrder, report, coc)
app.delete('/api/orders/:id/file/:fileType', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  const { fileType } = req.params;
  let filePath = null;

  if (fileType === 'drawing' && order.files?.drawing) {
    filePath = order.files.drawing.serverPath;
    order.files.drawing = null;
  } else if (fileType === 'customerOrder' && order.files?.customerOrder) {
    filePath = order.files.customerOrder.serverPath;
    order.files.customerOrder = null;
  } else if (fileType === 'report' && order.reportPath) {
    filePath = order.reportPath;
    order.reportPath = null;
  } else if (fileType === 'coc' && order.cocPath) {
    filePath = order.cocPath;
    order.cocPath = null;
  } else {
    return res.status(400).json({ error: 'סוג קובץ לא תקין או קובץ לא קיים' });
  }

  if (filePath) {
    const fullPath = path.join(__dirname, filePath.replace(/^\//, ''));
    try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
  }

  order.updatedAt = new Date().toISOString();
  saveOrders();
  res.json(order);
});

// ─── TRASH API ───────────────────────────────────────────────────────

// GET all trashed orders
app.get('/api/trash', (req, res) => {
  res.json([...trash].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)));
});

// RESTORE order from trash
app.post('/api/trash/:id/restore', (req, res) => {
  const idx = trash.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'פריט לא נמצא בסל המחזור' });

  const order = trash.splice(idx, 1)[0];
  delete order.deletedAt;
  order.updatedAt = new Date().toISOString();
  orders.push(order);
  saveOrders();
  saveTrash();
  res.json(order);
});

// PERMANENT DELETE from trash
app.delete('/api/trash/:id', (req, res) => {
  const idx = trash.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'פריט לא נמצא בסל המחזור' });

  const order = trash[idx];

  // Clean up all physical files
  const filesToDelete = [];
  if (order.files?.drawing?.serverPath) filesToDelete.push(order.files.drawing.serverPath);
  if (order.files?.customerOrder?.serverPath) filesToDelete.push(order.files.customerOrder.serverPath);
  if (order.files?.qualityDocs) {
    order.files.qualityDocs.forEach(f => filesToDelete.push(f.serverPath));
  }
  filesToDelete.forEach(fp => {
    const fullPath = path.join(__dirname, fp.replace(/^\//, ''));
    try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
  });
  if (order.reportPath) {
    const rp = path.join(__dirname, order.reportPath.replace(/^\//, ''));
    try { if (fs.existsSync(rp)) fs.unlinkSync(rp); } catch (e) { /* ignore */ }
  }
  if (order.cocPath) {
    const cp = path.join(__dirname, order.cocPath.replace(/^\//, ''));
    try { if (fs.existsSync(cp)) fs.unlinkSync(cp); } catch (e) { /* ignore */ }
  }

  trash.splice(idx, 1);
  saveTrash();
  res.json({ success: true });
});

// EMPTY entire trash
app.delete('/api/trash', (req, res) => {
  // Delete all physical files for trashed orders
  for (const order of trash) {
    const filesToDelete = [];
    if (order.files?.drawing?.serverPath) filesToDelete.push(order.files.drawing.serverPath);
    if (order.files?.customerOrder?.serverPath) filesToDelete.push(order.files.customerOrder.serverPath);
    if (order.files?.qualityDocs) order.files.qualityDocs.forEach(f => filesToDelete.push(f.serverPath));
    filesToDelete.forEach(fp => {
      const fullPath = path.join(__dirname, fp.replace(/^\//, ''));
      try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }
    });
    if (order.reportPath) {
      const rp = path.join(__dirname, order.reportPath.replace(/^\//, ''));
      try { if (fs.existsSync(rp)) fs.unlinkSync(rp); } catch (e) { /* ignore */ }
    }
    if (order.cocPath) {
      const cp = path.join(__dirname, order.cocPath.replace(/^\//, ''));
      try { if (fs.existsSync(cp)) fs.unlinkSync(cp); } catch (e) { /* ignore */ }
    }
  }
  trash.length = 0;
  saveTrash();
  res.json({ success: true });
});

// ─── TEMP FILE UPLOAD (for wizard flow) ──────────────────────────────

app.post('/api/temp-upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });
  res.json({
    originalName: req.file.originalname,
    serverPath: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  });
});

// ─── EXTRACT ORDER DATA FROM PDF ─────────────────────────────────────

app.post('/api/extract-order-data', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'נתיב קובץ חסר' });

  try {
    const result = await extractOrderData(filePath);
    res.json(result);
  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: 'שגיאה בחילוץ נתונים: ' + err.message });
  }
});

// ─── EXTRACT DOCUMENT DATA (dimensions + raw material + OCR) ────────

app.post('/api/extract-document-data', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'נתיב קובץ חסר' });

  try {
    req.setTimeout(90000); // Allow up to 90s for OCR processing
    const result = await extractDocumentDataFull(filePath);
    res.json(result);
  } catch (err) {
    console.error('Document extraction error:', err);
    res.status(500).json({
      dimensions: [],
      rawMaterial: { extracted: {}, confidence: {} },
      rawText: '',
      ocrUsed: false,
      ocrConfidence: null,
      processingTimeMs: 0,
      error: 'שגיאה בחילוץ נתונים: ' + err.message,
      warnings: [],
    });
  }
});

// ─── FILE UPLOAD ENDPOINTS (for existing orders) ─────────────────────

app.post('/api/orders/:id/upload/drawing', upload.single('file'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
  if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

  order.files.drawing = {
    originalName: req.file.originalname,
    serverPath: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  };
  if (order.status === 'new') order.status = 'drawing_uploaded';
  order.updatedAt = new Date().toISOString();
  saveOrders();
  res.json(order);
});

app.post('/api/orders/:id/upload/customer-order', upload.single('file'), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
  if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

  order.files.customerOrder = {
    originalName: req.file.originalname,
    serverPath: `/uploads/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  };
  order.updatedAt = new Date().toISOString();
  saveOrders();
  res.json(order);
});

app.post('/api/orders/:id/upload/quality-docs', upload.array('files', 10), (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'לא נבחרו קבצים' });

  if (!order.files.qualityDocs) order.files.qualityDocs = [];
  req.files.forEach(file => {
    order.files.qualityDocs.push({
      originalName: file.originalname,
      serverPath: `/uploads/${file.filename}`,
      uploadedAt: new Date().toISOString(),
    });
  });
  order.updatedAt = new Date().toISOString();
  saveOrders();
  res.json(order);
});

app.delete('/api/orders/:id/upload/quality-docs/:docIndex', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  const idx = parseInt(req.params.docIndex);
  if (isNaN(idx) || idx < 0 || idx >= (order.files.qualityDocs || []).length) {
    return res.status(400).json({ error: 'אינדקס מסמך לא תקין' });
  }

  const doc = order.files.qualityDocs[idx];
  const fullPath = path.join(__dirname, doc.serverPath.replace(/^\//, ''));
  try { if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } catch (e) { /* ignore */ }

  order.files.qualityDocs.splice(idx, 1);
  order.updatedAt = new Date().toISOString();
  saveOrders();
  res.json(order);
});

// ─── REPORT GENERATION ───────────────────────────────────────────────

function publicBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// Generate Excel report (dimensions + raw material sheets)
app.post('/api/orders/:id/report', async (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  if (req.body.dimensions) order.dimensions = req.body.dimensions;
  if (req.body.rawMaterial) order.rawMaterial = { ...order.rawMaterial, ...req.body.rawMaterial };

  try {
    const reportFileName = `report_${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.xlsx`;
    const reportAbsPath = path.join(__dirname, 'reports', reportFileName);
    await generateExcelReport(order, reportAbsPath, settings);

    if (!fs.existsSync(reportAbsPath)) {
      throw new Error(`קובץ הדוח לא נכתב לדיסק: ${reportAbsPath}`);
    }
    const stat = fs.statSync(reportAbsPath);
    if (stat.size === 0) {
      throw new Error(`קובץ הדוח ריק: ${reportAbsPath}`);
    }

    order.reportPath = `/reports/${reportFileName}`;
    order.status = 'report_generated';
    order.updatedAt = new Date().toISOString();
    saveOrders();

    const downloadUrl = `${publicBaseUrl(req)}/api/orders/${order.id}/download`;
    console.log(`[report] generated order=${order.id} file=${reportAbsPath} size=${stat.size}b url=${downloadUrl}`);
    res.json({ ...order, downloadUrl });
  } catch (err) {
    console.error('[report] generation error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת הדוח: ' + err.message });
  }
});

// Generate C.O.C. as DOCX
app.post('/api/orders/:id/coc', async (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'הזמנה לא נמצאה' });

  try {
    const cocFileName = `coc_${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.docx`;
    const cocAbsPath = path.join(__dirname, 'reports', cocFileName);
    await generateCOCDocx(order, cocAbsPath, settings);

    if (!fs.existsSync(cocAbsPath)) {
      throw new Error(`קובץ תעודת התאמה לא נכתב לדיסק: ${cocAbsPath}`);
    }
    const stat = fs.statSync(cocAbsPath);
    if (stat.size === 0) {
      throw new Error(`קובץ תעודת התאמה ריק: ${cocAbsPath}`);
    }

    order.cocPath = `/reports/${cocFileName}`;
    order.updatedAt = new Date().toISOString();
    saveOrders();

    const downloadUrl = `${publicBaseUrl(req)}/api/orders/${order.id}/download-coc`;
    console.log(`[coc] generated order=${order.id} file=${cocAbsPath} size=${stat.size}b url=${downloadUrl}`);
    res.json({ ...order, downloadUrl });
  } catch (err) {
    console.error('[coc] generation error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת תעודת התאמה: ' + err.message });
  }
});

// Serve a generated file for a given order + kind. Used for both GET and HEAD.
function serveGeneratedFile(kind, req, res) {
  const order = orders.find(o => o.id === req.params.id);
  const storedPath = kind === 'coc' ? order?.cocPath : order?.reportPath;
  const notFoundMsg = kind === 'coc' ? 'תעודת התאמה לא נמצאה' : 'דוח לא נמצא';

  if (!order || !storedPath) {
    console.warn(`[download:${kind}] missing order or path order=${req.params.id}`);
    return res.status(404).json({ error: notFoundMsg });
  }
  const filePath = path.join(__dirname, storedPath.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    console.warn(`[download:${kind}] file missing on disk path=${filePath}`);
    return res.status(404).json({ error: `קובץ ${kind === 'coc' ? 'תעודת התאמה' : 'דוח'} לא נמצא` });
  }
  console.log(`[download:${kind}] order=${order.id} file=${filePath}`);
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }
  res.download(filePath);
}

// DOWNLOAD report (GET + HEAD)
app.get('/api/orders/:id/download', (req, res) => serveGeneratedFile('report', req, res));
app.head('/api/orders/:id/download', (req, res) => serveGeneratedFile('report', req, res));

// DOWNLOAD C.O.C. (GET + HEAD)
app.get('/api/orders/:id/download-coc', (req, res) => serveGeneratedFile('coc', req, res));
app.head('/api/orders/:id/download-coc', (req, res) => serveGeneratedFile('coc', req, res));

// ─── Global Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'הקובץ גדול מדי. מקסימום 50MB.' });
    }
    return res.status(400).json({ error: `שגיאת העלאה: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Eagerly initialize OCR worker (downloads traineddata on first run)
  initOCR().catch(err => console.warn('[OCR] Pre-init failed (will retry on first use):', err.message));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await terminateOCR();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await terminateOCR();
  process.exit(0);
});

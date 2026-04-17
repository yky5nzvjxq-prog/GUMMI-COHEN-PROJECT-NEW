export const BASE_URL = "https://gummi-server.onrender.com";

const BASE = '/api';

async function request(url, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${url}`, options);;
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || `שגיאה ${res.status}` };
    }
    return data;
  } catch (err) {
    return { error: 'שגיאת תקשורת — לא ניתן להתחבר לשרת' };
  }
}

// ─── Orders ──────────────────────────────────────────────────────────

export async function fetchOrders() {
  const data = await request(`${BASE}/orders`);
  return data.error ? [] : data;
}

export async function fetchOrder(id) {
  return request(`${BASE}/orders/${id}`);
}

export async function fetchStats() {
  const data = await request(`${BASE}/stats`);
  return data.error ? { totalOrders: 0, newDrawings: 0, reportsGenerated: 0, awaitingReview: 0, newOrders: 0 } : data;
}

export async function createOrder(data) {
  return request(`${BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateOrder(id, data) {
  return request(`${BASE}/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteOrder(id) {
  return request(`${BASE}/orders/${id}`, { method: 'DELETE' });
}

export async function deleteOrderFile(orderId, fileType) {
  return request(`${BASE}/orders/${orderId}/file/${fileType}`, { method: 'DELETE' });
}

// ─── Trash ───────────────────────────────────────────────────────────

export async function fetchTrash() {
  const data = await request(`${BASE}/trash`);
  return data.error ? [] : data;
}

export async function restoreFromTrash(id) {
  return request(`${BASE}/trash/${id}/restore`, { method: 'POST' });
}

export async function permanentDelete(id) {
  return request(`${BASE}/trash/${id}`, { method: 'DELETE' });
}

export async function emptyTrash() {
  return request(`${BASE}/trash`, { method: 'DELETE' });
}

// ─── Temp Upload (wizard flow) ───────────────────────────────────────

export async function tempUpload(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request(`${BASE}/temp-upload`, { method: 'POST', body: fd });
}

export async function extractOrderData(filePath) {
  return request(`${BASE}/extract-order-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
}

export async function extractDocumentData(filePath) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for OCR
  try {
    const result = await request(`${BASE}/extract-document-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
      signal: controller.signal,
    });
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: 'הזמן הקצוב לחילוץ נתונים עבר. נסה שוב או העלה קובץ קטן יותר.' };
    }
    return { error: 'שגיאת תקשורת — לא ניתן להתחבר לשרת' };
  } finally {
    clearTimeout(timeoutId);
  }
}

//─── File Uploads ────────────────────────────────────────────────────

export async function uploadDrawing(orderId, file) {
  const fd = new FormData();
  fd.append('file', file);
  return request(`${BASE}/orders/${orderId}/upload/drawing`, { method: 'POST', body: fd });
}

export async function uploadCustomerOrder(orderId, file) {
  const fd = new FormData();
  fd.append('file', file);
  return request(`${BASE}/orders/${orderId}/upload/customer-order`, { method: 'POST', body: fd });
}

export async function uploadQualityDocs(orderId, files) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  return request(`${BASE}/orders/${orderId}/upload/quality-docs`, { method: 'POST', body: fd });
}

export async function removeQualityDoc(orderId, docIndex) {
  return request(`${BASE}/orders/${orderId}/upload/quality-docs/${docIndex}`, { method: 'DELETE' });
}

// ─── Reports ─────────────────────────────────────────────────────────

export async function generateReport(orderId, dimensions, rawMaterial) {
  return request(`${BASE}/orders/${orderId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dimensions, rawMaterial }),
  });
}

export async function generateCOC(orderId) {
  return request(`${BASE}/orders/${orderId}/coc`, { method: 'POST' });
}

export function downloadReportUrl(orderId) {
  const url = `${BASE_URL}${BASE}/orders/${orderId}/download`;
  console.log('[downloadReportUrl]', url);
  return url;
}

export function downloadCOCUrl(orderId) {
  const url = `${BASE_URL}${BASE}/orders/${orderId}/download-coc`;
  console.log('[downloadCOCUrl]', url);
  return url;
}

// Verify a report/coc file exists on the server before opening it.
// Returns true if HEAD succeeds, false otherwise.
async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

// Open a generated file in a new tab, but only after confirming it exists.
// `kind` is 'report' or 'coc' — used purely for the error message.
export async function openGeneratedFile(orderId, kind = 'report') {
  const url = kind === 'coc' ? downloadCOCUrl(orderId) : downloadReportUrl(orderId);
  console.log('[open]', kind, url);
  const ok = await headOk(url);
  if (!ok) {
    return { error: 'הקובץ לא נמצא בשרת — נסה ליצור את הדוח מחדש' };
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return { ok: true };
}

// ─── Settings ────────────────────────────────────────────────────────

export async function fetchSettings() {
  return request(`${BASE}/settings`);
}

export async function updateSettings(data) {
  return request(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ─── Folders ─────────────────────────────────────────────────────────

export async function fetchFolders() {
  const data = await request(`${BASE}/folders`);
  return data.error ? [] : data;
}

export async function createFolder(data) {
  return request(`${BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateFolder(id, data) {
  return request(`${BASE}/folders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteFolder(id) {
  return request(`${BASE}/folders/${id}`, { method: 'DELETE' });
}

const BASE_URL = "https://gummi-server.onrender.com";

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
  return `${BASE}/orders/${orderId}/download`;
}

export function downloadCOCUrl(orderId) {
  return `${BASE}/orders/${orderId}/download-coc`;
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

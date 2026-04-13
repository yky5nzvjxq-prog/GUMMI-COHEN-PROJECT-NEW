export const STATUS_MAP = {
  new: { label: 'חדש', class: 'status-new' },
  pending_review: { label: 'ממתין לאישור', class: 'status-pending_review' },
  approved: { label: 'אושר', class: 'status-approved' },
  drawing_uploaded: { label: 'שרטוט הועלה', class: 'status-drawing_uploaded' },
  report_generated: { label: 'דוח נוצר', class: 'status-report_generated' },
  reviewed: { label: 'נבדק', class: 'status-reviewed' },
};

export function statusBadge(status) {
  return STATUS_MAP[status] || { label: status, class: '' };
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL');
}

export function fileIcon(name) {
  if (!name) return 'file';
  const ext = name.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['png', 'jpg', 'jpeg', 'tif', 'tiff'].includes(ext)) return 'image';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['doc', 'docx'].includes(ext)) return 'word';
  return 'file';
}

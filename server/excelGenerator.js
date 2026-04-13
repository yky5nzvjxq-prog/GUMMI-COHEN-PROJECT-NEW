const ExcelJS = require('exceljs');

// ─── Color Palette ───────────────────────────────────────────────────
const C = {
  darkBlue: '1B3A5C',
  medBlue: '2E5F8A',
  lightBlue: 'D6E6F5',
  white: 'FFFFFF',
  lightGray: 'F2F2F2',
  border: '999999',
  warningBg: 'FFF3CD',
  warningText: '856404',
};

const thinBorder = {
  top: { style: 'thin', color: { argb: C.border } },
  left: { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  right: { style: 'thin', color: { argb: C.border } },
};

const headerFont = { name: 'Arial', bold: true, size: 11, color: { argb: C.white } };
const labelFont = { name: 'Arial', bold: true, size: 10, color: { argb: C.darkBlue } };
const valueFont = { name: 'Arial', size: 10 };
const smallFont = { name: 'Arial', size: 9 };

// ─── Helper: style a cell ───────────────────────────────────────────
function styleCell(cell, { font, fill, align, border: useBorder } = {}) {
  if (font) cell.font = font;
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  if (align) cell.alignment = align;
  if (useBorder !== false) cell.border = thinBorder;
}

// ─── Helper: add a section header row ────────────────────────────────
function addSectionHeader(sheet, row, text, lastCol) {
  sheet.mergeCells(`A${row}:${lastCol}${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = text;
  styleCell(cell, {
    font: { name: 'Arial', bold: true, size: 12, color: { argb: C.darkBlue } },
    fill: C.lightBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 28;
  return row;
}

// ═══════════════════════════════════════════════════════════════════════
//  SHEET 1: DIMENSIONS REPORT
// ═══════════════════════════════════════════════════════════════════════
function buildDimensionsSheet(workbook, order, settings) {
  const sheet = workbook.addWorksheet('דוח מידות', {
    properties: { defaultRowHeight: 22 },
    views: [{ rightToLeft: true }],
  });

  const factoryName = settings?.factoryName || 'מפעל גומי';

  sheet.columns = [
    { width: 5 },   // A
    { width: 22 },  // B
    { width: 22 },  // C
    { width: 16 },  // D
    { width: 14 },  // E
    { width: 14 },  // F
    { width: 20 },  // G
  ];

  let row = 1;

  // ── Title ──
  sheet.mergeCells(`A${row}:G${row}`);
  const titleCell = sheet.getCell(`A${row}`);
  titleCell.value = `דוח בדיקת מידות — ${factoryName}`;
  styleCell(titleCell, {
    font: { name: 'Arial', bold: true, size: 16, color: { argb: C.white } },
    fill: C.darkBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 36;

  // ── Subtitle ──
  row = 2;
  sheet.mergeCells(`A${row}:G${row}`);
  const subCell = sheet.getCell(`A${row}`);
  subCell.value = 'Dimensional Inspection Report';
  styleCell(subCell, {
    font: { name: 'Arial', size: 10, color: { argb: C.white } },
    fill: C.medBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 24;

  row = 3;
  sheet.getRow(row).height = 8;

  // ── Order Info Header ──
  row = 4;
  addSectionHeader(sheet, row, 'פרטי הזמנה', 'G');

  // ── Order Info Rows ──
  const infoFields = [
    ['מזהה ייחודי', order.id],
    ['שם לקוח', order.customerName],
    ["מס' הזמנה", order.orderNumber],
    ["מס' שרטוט", order.drawingNumber],
    ['מהדורה / גרסה', order.revision || '—'],
    ['תיאור חלק', order.partName],
    ['מק"ט', order.sku],
    ['כמות בהזמנה', order.quantity],
    ['כמות במדגם', order.sampleQuantity],
    ['תוכנית דגימה', order.samplingPlan],
    ['חומר', order.material],
    ['תאריך', order.date],
    ['הערות', order.notes || '—'],
  ];

  for (const [label, value] of infoFields) {
    row++;
    sheet.mergeCells(`B${row}:C${row}`);
    const lCell = sheet.getCell(`B${row}`);
    lCell.value = label;
    styleCell(lCell, {
      font: labelFont,
      fill: C.lightGray,
      align: { horizontal: 'right', vertical: 'middle' },
    });

    sheet.mergeCells(`D${row}:G${row}`);
    const vCell = sheet.getCell(`D${row}`);
    vCell.value = value ?? '';
    styleCell(vCell, {
      font: valueFont,
      align: { horizontal: 'right', vertical: 'middle' },
    });
  }

  // ── Traceability ──
  row += 2;
  addSectionHeader(sheet, row, 'עקיבות מסמכים', 'G');
  row++;

  const traceFields = [
    ['שרטוט מקור', order.files?.drawing?.originalName || 'לא הועלה'],
    ['הזמנת לקוח', order.files?.customerOrder?.originalName || 'לא הועלה'],
    ['מסמכי איכות', (order.files?.qualityDocs || []).map(f => f.originalName).join(', ') || 'לא הועלו'],
  ];

  for (const [label, value] of traceFields) {
    sheet.mergeCells(`B${row}:C${row}`);
    const lCell = sheet.getCell(`B${row}`);
    lCell.value = label;
    styleCell(lCell, {
      font: labelFont,
      fill: C.lightGray,
      align: { horizontal: 'right', vertical: 'middle' },
    });

    sheet.mergeCells(`D${row}:G${row}`);
    const vCell = sheet.getCell(`D${row}`);
    vCell.value = value;
    styleCell(vCell, {
      font: smallFont,
      align: { horizontal: 'right', vertical: 'middle' },
    });
    row++;
  }

  // ── Dimensions Table ──
  row += 1;
  addSectionHeader(sheet, row, 'טבלת מידות', 'G');

  row++;
  const colHeaders = ['#', 'סוג מידה / סימול', 'מידה נומינלית', 'טולרנס', 'מינימום', 'מקסימום', 'הערות'];
  const colKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  colKeys.forEach((col, i) => {
    const cell = sheet.getCell(`${col}${row}`);
    cell.value = colHeaders[i];
    styleCell(cell, {
      font: headerFont,
      fill: C.darkBlue,
      align: { horizontal: 'center', vertical: 'middle' },
    });
  });
  sheet.getRow(row).height = 26;

  const dims = order.dimensions || [];
  dims.forEach((dim, idx) => {
    row++;
    const bgColor = idx % 2 === 1 ? C.lightGray : C.white;
    // Calculate min/max only when nominal AND tolerance are both valid numbers
    const nom = parseFloat(dim.nominal);
    const tol = parseFloat(String(dim.tolerance || '').replace(/[±]/g, ''));
    const hasCalc = !isNaN(nom) && !isNaN(tol);
    const values = [idx + 1, dim.symbol, dim.nominal, dim.tolerance,
      hasCalc ? (nom - tol) : (dim.min || ''), hasCalc ? (nom + tol) : (dim.max || ''), dim.remarks || ''];

    colKeys.forEach((col, i) => {
      const cell = sheet.getCell(`${col}${row}`);
      cell.value = values[i];
      styleCell(cell, {
        font: valueFont,
        fill: bgColor,
        align: { horizontal: 'center', vertical: 'middle' },
      });

      // Highlight flagged dimensions
      if (dim.flaggedForReview) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.warningBg } };
      }
    });
  });

  // Empty rows for manual entry
  for (let i = 0; i < 5; i++) {
    row++;
    const bgColor = (dims.length + i) % 2 === 1 ? C.lightGray : C.white;
    colKeys.forEach((col, ci) => {
      const cell = sheet.getCell(`${col}${row}`);
      cell.value = ci === 0 ? dims.length + i + 1 : '';
      styleCell(cell, {
        font: valueFont,
        fill: bgColor,
        align: { horizontal: 'center', vertical: 'middle' },
      });
    });
  }

  // ── Measurement Results Section ──
  row += 2;
  const sampleCount = Math.min(order.sampleQuantity || 5, 10);
  const totalMeasCols = 2 + sampleCount + 1; // #, symbol, samples, pass/fail
  const lastMeasCol = String.fromCharCode(64 + totalMeasCols);

  addSectionHeader(sheet, row, 'תוצאות מדידה — למילוי ידני', lastMeasCol);

  row++;
  const measHeaders = ['#', 'סוג מידה'];
  for (let s = 1; s <= sampleCount; s++) measHeaders.push(`דגימה ${s}`);
  measHeaders.push('תקין?');

  measHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i);
    const cell = sheet.getCell(`${colLetter}${row}`);
    cell.value = h;
    styleCell(cell, {
      font: headerFont,
      fill: C.medBlue,
      align: { horizontal: 'center', vertical: 'middle' },
    });
  });
  sheet.getRow(row).height = 26;

  dims.forEach((dim, idx) => {
    row++;
    const bgColor = idx % 2 === 1 ? C.lightGray : C.white;
    const rowData = [idx + 1, dim.symbol];
    for (let s = 0; s < sampleCount; s++) rowData.push('');
    rowData.push('');

    rowData.forEach((val, i) => {
      const colLetter = String.fromCharCode(65 + i);
      const cell = sheet.getCell(`${colLetter}${row}`);
      cell.value = val;
      styleCell(cell, {
        font: valueFont,
        fill: bgColor,
        align: { horizontal: 'center', vertical: 'middle' },
      });
    });
  });

  // ── Signatures ──
  row += 2;
  const sigLabels = ['בודק:', 'מנהל איכות:', 'תאריך בדיקה:'];
  sigLabels.forEach((label, i) => {
    const startCol = i * 2 + 1;
    const colLetter = String.fromCharCode(64 + startCol);
    const nextCol = String.fromCharCode(65 + startCol);
    sheet.mergeCells(`${colLetter}${row}:${nextCol}${row}`);
    const cell = sheet.getCell(`${colLetter}${row}`);
    cell.value = label + ' _______________';
    cell.font = { name: 'Arial', size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ── Footer ──
  row += 2;
  sheet.mergeCells(`A${row}:G${row}`);
  const footer = sheet.getCell(`A${row}`);
  footer.value = `נוצר ע"י ${factoryName} — ${new Date().toLocaleDateString('he-IL')} — מסמך זה נועד לשימוש בבקרת איכות`;
  footer.font = { name: 'Arial', italic: true, size: 8, color: { argb: '888888' } };
  footer.alignment = { horizontal: 'center', vertical: 'middle' };

  // Print settings
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  SHEET 2: RAW MATERIAL
// ═══════════════════════════════════════════════════════════════════════
function buildRawMaterialSheet(workbook, order, settings) {
  const sheet = workbook.addWorksheet('חומר גלם', {
    properties: { defaultRowHeight: 22 },
    views: [{ rightToLeft: true }],
  });

  const factoryName = settings?.factoryName || 'מפעל גומי';

  sheet.columns = [
    { width: 5 },
    { width: 24 },
    { width: 30 },
    { width: 24 },
    { width: 24 },
    { width: 20 },
  ];

  let row = 1;

  // ── Title ──
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `גיליון חומר גלם — ${factoryName}`;
  styleCell(titleCell, {
    font: { name: 'Arial', bold: true, size: 14, color: { argb: C.white } },
    fill: C.darkBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(1).height = 34;

  row = 2;
  sheet.mergeCells('A2:F2');
  const subCell = sheet.getCell('A2');
  subCell.value = 'Raw Material Information Sheet';
  styleCell(subCell, {
    font: { name: 'Arial', size: 10, color: { argb: C.white } },
    fill: C.medBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(2).height = 24;

  row = 3;
  sheet.getRow(row).height = 8;

  // ── Order Reference ──
  row = 4;
  addSectionHeader(sheet, row, 'זיהוי הזמנה', 'F');

  const refFields = [
    ['מזהה ייחודי', order.id],
    ["מס' הזמנה", order.orderNumber],
    ['שם לקוח', order.customerName],
    ["מס' שרטוט", order.drawingNumber],
    ['מהדורה', order.revision || '—'],
    ['תיאור חלק', order.partName],
  ];

  for (const [label, value] of refFields) {
    row++;
    sheet.mergeCells(`B${row}:C${row}`);
    const lCell = sheet.getCell(`B${row}`);
    lCell.value = label;
    styleCell(lCell, {
      font: labelFont,
      fill: C.lightGray,
      align: { horizontal: 'right', vertical: 'middle' },
    });

    sheet.mergeCells(`D${row}:F${row}`);
    const vCell = sheet.getCell(`D${row}`);
    vCell.value = value ?? '';
    styleCell(vCell, {
      font: valueFont,
      align: { horizontal: 'right', vertical: 'middle' },
    });
  }

  // ── Raw Material Details ──
  row += 2;
  addSectionHeader(sheet, row, 'פרטי חומר גלם', 'F');

  const rm = order.rawMaterial || {};
  const matFields = [
    ['סוג חומר', rm.materialType],
    ['תיאור חומר', rm.description],
    ['ספק', rm.supplier],
    ["מס' אצווה", rm.batchNumber],
    ["מס' תעודה", rm.certNumber],
    ['קשיות', rm.hardness],
    ['צבע', rm.color],
    ['הערות', rm.notes],
  ];

  for (const [label, value] of matFields) {
    row++;
    sheet.mergeCells(`B${row}:C${row}`);
    const lCell = sheet.getCell(`B${row}`);
    lCell.value = label;
    styleCell(lCell, {
      font: labelFont,
      fill: C.lightGray,
      align: { horizontal: 'right', vertical: 'middle' },
    });

    sheet.mergeCells(`D${row}:F${row}`);
    const vCell = sheet.getCell(`D${row}`);
    vCell.value = value || '';
    styleCell(vCell, {
      font: valueFont,
      align: { horizontal: 'right', vertical: 'middle' },
    });

    // Highlight if flagged
    if (rm.flaggedForReview) {
      vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.warningBg } };
    }
  }

  // ── Material from Drawing ──
  if (order.material) {
    row += 2;
    addSectionHeader(sheet, row, 'חומר לפי שרטוט / הזמנה', 'F');
    row++;
    sheet.mergeCells(`B${row}:C${row}`);
    const lCell = sheet.getCell(`B${row}`);
    lCell.value = 'חומר מוגדר';
    styleCell(lCell, {
      font: labelFont,
      fill: C.lightGray,
      align: { horizontal: 'right', vertical: 'middle' },
    });
    sheet.mergeCells(`D${row}:F${row}`);
    const vCell = sheet.getCell(`D${row}`);
    vCell.value = order.material;
    styleCell(vCell, {
      font: valueFont,
      align: { horizontal: 'right', vertical: 'middle' },
    });
  }

  // ── Signatures ──
  row += 3;
  const sigLabels = ['מנהל חומרים:', 'מנהל איכות:', 'תאריך:'];
  sigLabels.forEach((label, i) => {
    const startCol = i * 2 + 1;
    const colLetter = String.fromCharCode(64 + startCol);
    const nextCol = String.fromCharCode(65 + startCol);
    sheet.mergeCells(`${colLetter}${row}:${nextCol}${row}`);
    const cell = sheet.getCell(`${colLetter}${row}`);
    cell.value = label + ' _______________';
    cell.font = { name: 'Arial', size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ── Footer ──
  row += 2;
  sheet.mergeCells(`A${row}:F${row}`);
  const footer = sheet.getCell(`A${row}`);
  footer.value = `נוצר ע"י ${factoryName} — ${new Date().toLocaleDateString('he-IL')}`;
  footer.font = { name: 'Arial', italic: true, size: 8, color: { argb: '888888' } };
  footer.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.pageSetup = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════
async function generateExcelReport(order, outputPath, settings) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings?.factoryName || 'Rubber Factory Dashboard';
  workbook.created = new Date();

  buildDimensionsSheet(workbook, order, settings);
  buildRawMaterialSheet(workbook, order, settings);

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { generateExcelReport };

const ExcelJS = require('exceljs');

const C = {
  darkBlue: '1B3A5C',
  medBlue: '2E5F8A',
  lightBlue: 'D6E6F5',
  white: 'FFFFFF',
  lightGray: 'F2F2F2',
  border: '999999',
  green: '28A745',
  greenBg: 'D4EDDA',
};

const thinBorder = {
  top: { style: 'thin', color: { argb: C.border } },
  left: { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  right: { style: 'thin', color: { argb: C.border } },
};

function styleCell(cell, { font, fill, align, border: useBorder } = {}) {
  if (font) cell.font = font;
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  if (align) cell.alignment = align;
  if (useBorder !== false) cell.border = thinBorder;
}

async function generateCOC(order, outputPath, settings) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings?.factoryName || 'Rubber Factory';
  workbook.created = new Date();

  const factoryName = settings?.factoryName || 'מפעל גומי';
  const managerName = settings?.managerName || '';

  const sheet = workbook.addWorksheet('תעודת התאמה', {
    properties: { defaultRowHeight: 22 },
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { width: 5 },
    { width: 24 },
    { width: 28 },
    { width: 24 },
    { width: 28 },
    { width: 5 },
  ];

  let row = 1;

  // ── Title ──
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `תעודת התאמה — ${factoryName}`;
  styleCell(titleCell, {
    font: { name: 'Arial', bold: true, size: 18, color: { argb: C.white } },
    fill: C.darkBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(1).height = 42;

  row = 2;
  sheet.mergeCells('A2:F2');
  const subCell = sheet.getCell('A2');
  subCell.value = 'Certificate of Conformance / Manufacturer Declaration';
  styleCell(subCell, {
    font: { name: 'Arial', size: 11, color: { argb: C.white } },
    fill: C.medBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(2).height = 28;

  row = 3;
  sheet.getRow(row).height = 10;

  // ── Declaration text ──
  row = 4;
  sheet.mergeCells(`A${row}:F${row}`);
  const declCell = sheet.getCell(`A${row}`);
  declCell.value = `אנו, ${factoryName}, מצהירים בזאת כי הפריטים המפורטים להלן יוצרו בהתאם לשרטוט, למפרט ולדרישות ההזמנה.`;
  styleCell(declCell, {
    font: { name: 'Arial', size: 11, color: { argb: C.darkBlue } },
    fill: C.lightBlue,
    align: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: false,
  });
  sheet.getRow(row).height = 40;

  row = 5;
  sheet.getRow(row).height = 10;

  // ── Order Details Section ──
  row = 6;
  sheet.mergeCells(`A${row}:F${row}`);
  const secCell = sheet.getCell(`A${row}`);
  secCell.value = 'פרטי הזמנה';
  styleCell(secCell, {
    font: { name: 'Arial', bold: true, size: 13, color: { argb: C.darkBlue } },
    fill: C.lightBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 30;

  const detailFields = [
    ['שם לקוח', order.customerName, "מס' הזמנה", order.orderNumber],
    ["מס' שרטוט", order.drawingNumber, 'מהדורה / גרסה', order.revision || '—'],
    ['תיאור חלק', order.partName, 'מק"ט', order.sku],
    ['כמות בהזמנה', order.quantity, 'תאריך הזמנה', order.date],
    ['חומר', order.material, 'תוכנית דגימה', order.samplingPlan],
    ['כמות במדגם', order.sampleQuantity, '', ''],
  ];

  const labelFont = { name: 'Arial', bold: true, size: 10, color: { argb: C.darkBlue } };
  const valueFont = { name: 'Arial', size: 10 };

  for (const [label1, val1, label2, val2] of detailFields) {
    row++;
    // Left pair (in RTL)
    const cellB = sheet.getCell(`B${row}`);
    cellB.value = label1;
    styleCell(cellB, { font: labelFont, fill: C.lightGray, align: { horizontal: 'right', vertical: 'middle' } });

    const cellC = sheet.getCell(`C${row}`);
    cellC.value = val1 ?? '';
    styleCell(cellC, { font: valueFont, align: { horizontal: 'right', vertical: 'middle' } });

    // Right pair
    if (label2) {
      const cellD = sheet.getCell(`D${row}`);
      cellD.value = label2;
      styleCell(cellD, { font: labelFont, fill: C.lightGray, align: { horizontal: 'right', vertical: 'middle' } });

      const cellE = sheet.getCell(`E${row}`);
      cellE.value = val2 ?? '';
      styleCell(cellE, { font: valueFont, align: { horizontal: 'right', vertical: 'middle' } });
    }
  }

  // ── Raw Material Section ──
  row += 2;
  sheet.mergeCells(`A${row}:F${row}`);
  const matSecCell = sheet.getCell(`A${row}`);
  matSecCell.value = 'פרטי חומר גלם';
  styleCell(matSecCell, {
    font: { name: 'Arial', bold: true, size: 13, color: { argb: C.darkBlue } },
    fill: C.lightBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 30;

  const rm = order.rawMaterial || {};
  const matFields = [
    ['סוג חומר', rm.materialType, 'תיאור', rm.description],
    ['ספק', rm.supplier, "מס' אצווה", rm.batchNumber],
    ["מס' תעודה", rm.certNumber, 'קשיות', rm.hardness],
    ['צבע', rm.color, '', ''],
  ];

  for (const [label1, val1, label2, val2] of matFields) {
    row++;
    const cellB = sheet.getCell(`B${row}`);
    cellB.value = label1;
    styleCell(cellB, { font: labelFont, fill: C.lightGray, align: { horizontal: 'right', vertical: 'middle' } });

    const cellC = sheet.getCell(`C${row}`);
    cellC.value = val1 || '';
    styleCell(cellC, { font: valueFont, align: { horizontal: 'right', vertical: 'middle' } });

    if (label2) {
      const cellD = sheet.getCell(`D${row}`);
      cellD.value = label2;
      styleCell(cellD, { font: labelFont, fill: C.lightGray, align: { horizontal: 'right', vertical: 'middle' } });

      const cellE = sheet.getCell(`E${row}`);
      cellE.value = val2 || '';
      styleCell(cellE, { font: valueFont, align: { horizontal: 'right', vertical: 'middle' } });
    }
  }

  // ── Traceability ──
  row += 2;
  sheet.mergeCells(`A${row}:F${row}`);
  const traceCell = sheet.getCell(`A${row}`);
  traceCell.value = 'עקיבות מסמכים';
  styleCell(traceCell, {
    font: { name: 'Arial', bold: true, size: 13, color: { argb: C.darkBlue } },
    fill: C.lightBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 30;

  const traceFields = [
    ['שרטוט מקור', order.files?.drawing?.originalName || 'לא הועלה'],
    ['הזמנת לקוח', order.files?.customerOrder?.originalName || 'לא הועלה'],
    ['מסמכי איכות', (order.files?.qualityDocs || []).map(f => f.originalName).join(', ') || 'לא הועלו'],
    ['דוח מידות', order.reportPath ? 'נוצר' : 'טרם נוצר'],
  ];

  for (const [label, value] of traceFields) {
    row++;
    sheet.mergeCells(`B${row}:C${row}`);
    const lCell = sheet.getCell(`B${row}`);
    lCell.value = label;
    styleCell(lCell, { font: labelFont, fill: C.lightGray, align: { horizontal: 'right', vertical: 'middle' } });

    sheet.mergeCells(`D${row}:E${row}`);
    const vCell = sheet.getCell(`D${row}`);
    vCell.value = value;
    styleCell(vCell, { font: { name: 'Arial', size: 9 }, align: { horizontal: 'right', vertical: 'middle' } });
  }

  // ── Conformance Statement ──
  row += 2;
  sheet.mergeCells(`A${row}:F${row}`);
  const confCell = sheet.getCell(`A${row}`);
  confCell.value = 'הצהרת התאמה';
  styleCell(confCell, {
    font: { name: 'Arial', bold: true, size: 13, color: { argb: C.darkBlue } },
    fill: C.lightBlue,
    align: { horizontal: 'center', vertical: 'middle' },
  });
  sheet.getRow(row).height = 30;

  row++;
  sheet.mergeCells(`B${row}:E${row}`);
  const stmtCell = sheet.getCell(`B${row}`);
  stmtCell.value = 'אנו מאשרים כי הפריטים הנ"ל נבדקו ונמצאו תואמים לדרישות השרטוט, המפרט, ותנאי ההזמנה.';
  styleCell(stmtCell, {
    font: { name: 'Arial', size: 11, color: { argb: '1B5E20' } },
    fill: C.greenBg,
    align: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });
  sheet.getRow(row).height = 40;

  // ── Signatures ──
  row += 3;
  const sigPairs = [
    ['חתימת מנהל איכות:', managerName || '_______________'],
    ['תאריך:', new Date().toLocaleDateString('he-IL')],
    ['חותמת מפעל:', '_______________'],
  ];

  sigPairs.forEach(([label, value], i) => {
    const startCol = i * 2 + 1;
    const colLetter = String.fromCharCode(64 + startCol);
    const nextCol = String.fromCharCode(65 + startCol);
    sheet.mergeCells(`${colLetter}${row}:${nextCol}${row}`);
    const cell = sheet.getCell(`${colLetter}${row}`);
    cell.value = `${label} ${value}`;
    cell.font = { name: 'Arial', size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  row++;
  sheet.mergeCells(`A${row}:F${row}`);
  sheet.getRow(row).height = 10;

  row++;
  sigPairs.forEach(([label], i) => {
    const startCol = i * 2 + 1;
    const colLetter = String.fromCharCode(64 + startCol);
    const nextCol = String.fromCharCode(65 + startCol);
    sheet.mergeCells(`${colLetter}${row}:${nextCol}${row}`);
    const cell = sheet.getCell(`${colLetter}${row}`);
    cell.value = '________________________';
    cell.font = { name: 'Arial', size: 9, color: { argb: C.border } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ── Footer ──
  row += 2;
  sheet.mergeCells(`A${row}:F${row}`);
  const footer = sheet.getCell(`A${row}`);
  footer.value = `${factoryName} — תעודת התאמה — ${new Date().toLocaleDateString('he-IL')} — מסמך זה מהווה אישור רשמי של היצרן`;
  footer.font = { name: 'Arial', italic: true, size: 8, color: { argb: '888888' } };
  footer.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.pageSetup = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { generateCOC };

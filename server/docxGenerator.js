const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, BorderStyle, WidthType,
  TableLayoutType, HeadingLevel, ShadingType,
} = require('docx');
const fs = require('fs');

// ─── Helpers ─────────────────────────────────────────────────────────

const FONT = 'Arial';
const BLUE = '1B3A5C';
const MED_BLUE = '2E5F8A';
const LIGHT_BLUE = 'D6E6F5';
const GREEN_BG = 'D4EDDA';

function rtlParagraph(runs, options = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: options.alignment || AlignmentType.RIGHT,
    spacing: options.spacing || { after: 100 },
    ...options,
    children: Array.isArray(runs) ? runs : [runs],
  });
}

function textRun(text, options = {}) {
  return new TextRun({
    text: text ?? '',
    font: FONT,
    size: options.size || 20, // 10pt
    rtl: true,
    ...options,
  });
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0 };
  return { top: none, bottom: none, left: none, right: none };
}

function thinBorders() {
  const thin = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
  return { top: thin, bottom: thin, left: thin, right: thin };
}

function labelCell(text, width) {
  return new TableCell({
    width: { size: width || 2500, type: WidthType.DXA },
    borders: thinBorders(),
    shading: { type: ShadingType.SOLID, color: LIGHT_BLUE },
    children: [rtlParagraph(textRun(text, { bold: true, size: 20, color: BLUE }), { spacing: { before: 40, after: 40 } })],
  });
}

function valueCell(text, width) {
  return new TableCell({
    width: { size: width || 2500, type: WidthType.DXA },
    borders: thinBorders(),
    children: [rtlParagraph(textRun(String(text ?? ''), { size: 20 }), { spacing: { before: 40, after: 40 } })],
  });
}

function sectionHeading(text) {
  return rtlParagraph(
    textRun(text, { bold: true, size: 26, color: BLUE }),
    { alignment: AlignmentType.CENTER, spacing: { before: 300, after: 150 } }
  );
}

function spacer() {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

// ─── Build detail table (2-column pairs per row) ─────────────────────
function buildDetailTable(rows) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 9500, type: WidthType.DXA },
    rows: rows.map(([label1, val1, label2, val2]) => {
      const cells = [labelCell(label1, 2000), valueCell(val1, 2750)];
      if (label2) {
        cells.push(labelCell(label2, 2000));
        cells.push(valueCell(val2, 2750));
      } else {
        cells.push(new TableCell({
          width: { size: 4750, type: WidthType.DXA },
          columnSpan: 2,
          borders: thinBorders(),
          children: [new Paragraph({ children: [] })],
        }));
      }
      return new TableRow({ children: cells });
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════
async function generateCOCDocx(order, outputPath, settings) {
  const factoryName = settings?.factoryName || 'מפעל גומי';
  const managerName = settings?.managerName || '';
  const today = new Date().toLocaleDateString('he-IL');
  const rm = order.rawMaterial || {};

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        // ── Title ──
        rtlParagraph(
          textRun(factoryName, { bold: true, size: 36, color: BLUE }),
          { alignment: AlignmentType.CENTER, spacing: { after: 50 } }
        ),
        rtlParagraph(
          textRun('Certificate of Conformance / Manufacturer Declaration', { size: 22, color: MED_BLUE, italics: true }),
          { alignment: AlignmentType.CENTER, spacing: { after: 50 } }
        ),
        rtlParagraph(
          textRun('תעודת התאמה / הצהרת יצרן', { bold: true, size: 28, color: BLUE }),
          { alignment: AlignmentType.CENTER, spacing: { after: 200 } }
        ),

        // ── Declaration ──
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 200 },
          shading: { type: ShadingType.SOLID, color: LIGHT_BLUE },
          children: [
            textRun(`אנו, ${factoryName}, מצהירים בזאת כי הפריטים המפורטים להלן יוצרו בהתאם לשרטוט, למפרט ולדרישות ההזמנה.`, {
              size: 22, color: BLUE,
            }),
          ],
        }),

        // ── Order Details ──
        sectionHeading('פרטי הזמנה'),
        buildDetailTable([
          ['שם לקוח', order.customerName, "מס' הזמנה", order.orderNumber],
          ["מס' שרטוט", order.drawingNumber, 'מהדורה / גרסה', order.revision || '—'],
          ['תיאור חלק', order.partName, 'מק"ט', order.sku],
          ['כמות בהזמנה', order.quantity, 'תאריך הזמנה', order.date],
          ['חומר', order.material, 'תוכנית דגימה', order.samplingPlan],
          ['כמות במדגם', order.sampleQuantity, '', ''],
        ]),

        spacer(),

        // ── Raw Material ──
        sectionHeading('פרטי חומר גלם'),
        buildDetailTable([
          ['סוג חומר', rm.materialType, 'תיאור', rm.description],
          ['ספק', rm.supplier, "מס' אצווה", rm.batchNumber],
          ["מס' תעודה", rm.certNumber, 'קשיות', rm.hardness],
          ['צבע', rm.color, '', ''],
        ]),

        spacer(),

        // ── Traceability ──
        sectionHeading('עקיבות מסמכים'),
        buildDetailTable([
          ['מזהה ייחודי', order.id, '', ''],
          ['שרטוט מקור', order.files?.drawing?.originalName || 'לא הועלה', '', ''],
          ['הזמנת לקוח', order.files?.customerOrder?.originalName || 'לא הועלה', '', ''],
          ['מסמכי איכות', (order.files?.qualityDocs || []).map(f => f.originalName).join(', ') || 'לא הועלו', '', ''],
          ['דוח מידות', order.reportPath ? 'נוצר' : 'טרם נוצר', '', ''],
          ['תאריך יצירת תעודה', today, '', ''],
        ]),

        spacer(),

        // ── Conformance Statement ──
        sectionHeading('הצהרת התאמה'),
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 200 },
          shading: { type: ShadingType.SOLID, color: GREEN_BG },
          children: [
            textRun('אנו מאשרים כי הפריטים הנ"ל נבדקו ונמצאו תואמים לדרישות השרטוט, המפרט, ותנאי ההזמנה.', {
              size: 22, color: '1B5E20', bold: true,
            }),
          ],
        }),

        spacer(),
        spacer(),

        // ── Signatures ──
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 9500, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 3166, type: WidthType.DXA },
                  borders: noBorders(),
                  children: [
                    rtlParagraph(textRun('חתימת מנהל איכות:', { bold: true, size: 20 }), { alignment: AlignmentType.CENTER }),
                    rtlParagraph(textRun(managerName || '_______________', { size: 20 }), { alignment: AlignmentType.CENTER }),
                  ],
                }),
                new TableCell({
                  width: { size: 3167, type: WidthType.DXA },
                  borders: noBorders(),
                  children: [
                    rtlParagraph(textRun('תאריך:', { bold: true, size: 20 }), { alignment: AlignmentType.CENTER }),
                    rtlParagraph(textRun(today, { size: 20 }), { alignment: AlignmentType.CENTER }),
                  ],
                }),
                new TableCell({
                  width: { size: 3167, type: WidthType.DXA },
                  borders: noBorders(),
                  children: [
                    rtlParagraph(textRun('חותמת מפעל:', { bold: true, size: 20 }), { alignment: AlignmentType.CENTER }),
                    rtlParagraph(textRun('_______________', { size: 20 }), { alignment: AlignmentType.CENTER }),
                  ],
                }),
              ],
            }),
          ],
        }),

        spacer(),
        spacer(),

        // ── Footer ──
        rtlParagraph(
          textRun(`${factoryName} — תעודת התאמה — ${today} — מסמך זה מהווה אישור רשמי של היצרן`, {
            size: 16, color: '888888', italics: true,
          }),
          { alignment: AlignmentType.CENTER }
        ),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { generateCOCDocx };

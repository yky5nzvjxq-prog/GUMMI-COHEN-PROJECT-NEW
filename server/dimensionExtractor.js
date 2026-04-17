/**
 * Dimension Extractor Module
 *
 * Parses text extracted from drawing/document files to find
 * structured dimension data (tolerances, nominal values, etc.)
 *
 * All extracted dimensions are flagged with flaggedForReview: true
 * so the user must verify before final use.
 */

/**
 * Extract dimensions from document text.
 * Returns array of dimension objects matching the app schema.
 */
function extractDimensions(text, options = {}) {
  if (!text || !text.trim()) return [];

  const { ocrUsed = false } = options;
  const dimensions = [];
  const seen = new Set(); // prevent duplicates

  // Pattern 1: Diameter dimensions — Ø50.00 ±0.5 or ⌀30 +0.1/-0.05
  const diameterPatterns = [
    // Ø50.00 ±0.50
    /[Øø⌀]\s*(\d+(?:\.\d+)?)\s*[±]\s*(\d+(?:\.\d+)?)/g,
    // Ø50.00 +0.10 / -0.05 or +0.10/-0.05
    /[Øø⌀]\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*\/?\s*-\s*(\d+(?:\.\d+)?)/g,
  ];

  // Pattern 1a: Ø with ±
  let m;
  const re1 = /[Øø⌀]\s*(\d+(?:\.\d+)?)\s*[±]\s*(\d+(?:\.\d+)?)/g;
  while ((m = re1.exec(text)) !== null) {
    const nominal = parseFloat(m[1]);
    const tol = parseFloat(m[2]);
    const key = `Ø${nominal}`;
    if (!seen.has(key)) {
      seen.add(key);
      dimensions.push({
        symbol: `Ø${nominal}`,
        nominal: String(nominal),
        tolerance: `±${tol}`,
        min: String(round(nominal - tol)),
        max: String(round(nominal + tol)),
        remarks: '',
        flaggedForReview: true,
      });
    }
  }

  // Pattern 1b: Ø with +/- asymmetric
  const re1b = /[Øø⌀]\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*\/?\s*-\s*(\d+(?:\.\d+)?)/g;
  while ((m = re1b.exec(text)) !== null) {
    const nominal = parseFloat(m[1]);
    const plus = parseFloat(m[2]);
    const minus = parseFloat(m[3]);
    const key = `Ø${nominal}`;
    if (!seen.has(key)) {
      seen.add(key);
      dimensions.push({
        symbol: `Ø${nominal}`,
        nominal: String(nominal),
        tolerance: `+${plus}/-${minus}`,
        min: String(round(nominal - minus)),
        max: String(round(nominal + plus)),
        remarks: '',
        flaggedForReview: true,
      });
    }
  }

  // Pattern 2: Generic dimension with ± tolerance (not diameter)
  // e.g., "25.00 ±0.30" appearing standalone or after dimension label
  const re2 = /(?:^|[\s,;(])(\d+(?:\.\d+)?)\s*[±]\s*(\d+(?:\.\d+)?)(?:\s*mm)?/gm;
  while ((m = re2.exec(text)) !== null) {
    const nominal = parseFloat(m[1]);
    const tol = parseFloat(m[2]);
    // Skip very small numbers (likely not dimensions) or already captured
    if (nominal < 0.1 || nominal > 9999) continue;
    const key = `${nominal}±${tol}`;
    if (!seen.has(key)) {
      seen.add(key);
      dimensions.push({
        symbol: '',
        nominal: String(nominal),
        tolerance: `±${tol}`,
        min: String(round(nominal - tol)),
        max: String(round(nominal + tol)),
        remarks: '',
        flaggedForReview: true,
      });
    }
  }

  // Pattern 3: Asymmetric tolerance without diameter symbol
  // e.g., "25.00 +0.10 -0.05"
  const re3 = /(?:^|[\s,;(])(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*\/?\s*-\s*(\d+(?:\.\d+)?)/gm;
  while ((m = re3.exec(text)) !== null) {
    const nominal = parseFloat(m[1]);
    const plus = parseFloat(m[2]);
    const minus = parseFloat(m[3]);
    if (nominal < 0.1 || nominal > 9999) continue;
    const key = `${nominal}+${plus}-${minus}`;
    if (!seen.has(key)) {
      seen.add(key);
      dimensions.push({
        symbol: '',
        nominal: String(nominal),
        tolerance: `+${plus}/-${minus}`,
        min: String(round(nominal - minus)),
        max: String(round(nominal + plus)),
        remarks: '',
        flaggedForReview: true,
      });
    }
  }

  // Pattern 4: ID/OD/Width/Height/Thickness labeled dimensions
  // e.g., "ID: 25.00", "OD: 50.00", "W: 10.00", "T: 5.00"
  const labeledPatterns = [
    { re: /\bI\.?D\.?\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'ID' },
    { re: /\bO\.?D\.?\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'OD' },
    { re: /\b(?:Width|W)\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'W' },
    { re: /\b(?:Height|H)\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'H' },
    { re: /\b(?:Thickness|THK|T)\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'T' },
    { re: /\b(?:Length|L)\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'L' },
    // Hebrew labels
    { re: /(?:קוטר\s*(?:פנימי|פני))\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'ID' },
    { re: /(?:קוטר\s*(?:חיצוני|חיצ))\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'OD' },
    { re: /(?:רוחב)\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'W' },
    { re: /(?:עובי|גובה)\s*[=:\-]\s*(\d+(?:\.\d+)?)/gi, label: 'H' },
  ];

  for (const { re, label } of labeledPatterns) {
    while ((m = re.exec(text)) !== null) {
      const nominal = parseFloat(m[1]);
      if (nominal < 0.01 || nominal > 9999) continue;
      const key = `${label}:${nominal}`;
      if (!seen.has(key)) {
        seen.add(key);
        dimensions.push({
          symbol: label,
          nominal: String(nominal),
          tolerance: '',
          min: '',
          max: '',
          remarks: `חולץ אוטומטית (${label})`,
          flaggedForReview: true,
        });
      }
    }
  }

  // Pattern 5: Tabular dimensions — rows with multiple numbers that look like dimension data
  // Format: "symbol | nominal | tolerance | min | max" or similar
  const tableRowRe = /^[\s]*([A-Za-zØø⌀\d]+)\s+(\d+(?:\.\d+)?)\s+([±+\-\d.\/]+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/gm;
  while ((m = tableRowRe.exec(text)) !== null) {
    const sym = m[1].trim();
    const nominal = m[2];
    const tol = m[3];
    const min = m[4];
    const max = m[5];
    const key = `tbl:${sym}:${nominal}`;
    if (!seen.has(key)) {
      seen.add(key);
      dimensions.push({
        symbol: sym,
        nominal,
        tolerance: tol,
        min,
        max,
        remarks: 'חולץ מטבלה',
        flaggedForReview: true,
      });
    }
  }

  // OCR post-processing: filter unreasonable values and add confidence
  if (ocrUsed) {
    return dimensions
      .filter(d => {
        const nom = parseFloat(d.nominal);
        return !isNaN(nom) && nom >= 0.01 && nom <= 5000;
      })
      .map(d => ({
        ...d,
        confidence: d.tolerance ? 0.7 : 0.4, // higher confidence if tolerance was also extracted
        remarks: d.remarks || 'חולץ באמצעות OCR',
      }));
  }

  return dimensions;
}

function round(num) {
  return Math.round(num * 1000) / 1000;
}

module.exports = { extractDimensions };

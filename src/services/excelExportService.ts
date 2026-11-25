import XLSX from 'xlsx-js-style';
import { Project } from '../types/boq';
import {
  calculateBlockGeneralWorks,
  calculateSpace,
  collectProjectCustomColumns,
  resolveEffectiveSubRooms,
  round2,
  safeNum,
  STANDARD_BOQ_COLUMNS,
} from '../utils/calculations';

type CellStyle = Record<string, unknown>;

interface StyledCell {
  v?: string | number;
  f?: string;
  t?: 's' | 'n' | 'b';
  s?: CellStyle;
}

function colLetter(colIdxZeroBased: number): string {
  let n = colIdxZeroBased + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const FONT_NAME = 'Arial';

const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const HEADER_BORDER = {
  top: { style: 'medium', color: { rgb: '064E3B' } },
  bottom: { style: 'medium', color: { rgb: '064E3B' } },
  left: { style: 'thin', color: { rgb: '334155' } },
  right: { style: 'thin', color: { rgb: '334155' } },
};

const SUBTOTAL_BORDER = {
  top: { style: 'thin', color: { rgb: '059669' } },
  bottom: { style: 'medium', color: { rgb: '059669' } },
  left: { style: 'thin', color: { rgb: 'A7F3D0' } },
  right: { style: 'thin', color: { rgb: 'A7F3D0' } },
};

const GRAND_BORDER = {
  top: { style: 'medium', color: { rgb: '10B981' } },
  bottom: { style: 'medium', color: { rgb: '10B981' } },
  left: { style: 'thin', color: { rgb: '334155' } },
  right: { style: 'thin', color: { rgb: '334155' } },
};

const STYLES = {
  titleBanner: {
    font: { name: FONT_NAME, sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: GRAND_BORDER,
  },
  metaLabel: {
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: '065F46' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  },
  metaValue: {
    font: { name: FONT_NAME, sz: 10, bold: false, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  },
  tableHeader: {
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: HEADER_BORDER,
  },
  tableHeaderHighlight: {
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '065F46' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: HEADER_BORDER,
  },
  unitsHeader: {
    font: { name: FONT_NAME, sz: 9, bold: true, color: { rgb: '0E7490' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'ECFEFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  },
  textCell: (zebra: boolean) => ({
    font: { name: FONT_NAME, sz: 10, bold: false, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  }),
  blockNameCell: (zebra: boolean) => ({
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: '1E293B' } },
    fill: { patternType: 'solid', fgColor: { rgb: zebra ? 'F1F5F9' : 'F8FAFC' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  }),
  dimCell: (zebra: boolean) => ({
    font: { name: FONT_NAME, sz: 10, bold: false, color: { rgb: '334155' } },
    fill: { patternType: 'solid', fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: THIN_BORDER,
    numFmt: '#,##0.##',
  }),
  qtyCell: (zebra: boolean, nonZero: boolean) => ({
    font: {
      name: FONT_NAME,
      sz: 10,
      bold: nonZero,
      color: { rgb: nonZero ? '0F172A' : '94A3B8' },
    },
    fill: { patternType: 'solid', fgColor: { rgb: zebra ? 'F8FAFC' : 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: THIN_BORDER,
    numFmt: '#,##0.##',
  }),
  summaryTotalCol: (zebra: boolean) => ({
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: '065F46' } },
    fill: { patternType: 'solid', fgColor: { rgb: zebra ? 'D1FAE5' : 'ECFDF5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: THIN_BORDER,
    numFmt: '#,##0.##',
  }),
  subtotalLabel: {
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: '065F46' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: SUBTOTAL_BORDER,
  },
  subtotalFormula: {
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: '065F46' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: SUBTOTAL_BORDER,
    numFmt: '#,##0.##',
  },
  noteLabel: {
    font: { name: FONT_NAME, sz: 10, bold: true, color: { rgb: '0E7490' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'ECFEFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  },
  noteContent: {
    font: { name: FONT_NAME, sz: 10, bold: false, color: { rgb: '1E293B' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: THIN_BORDER,
  },
  grandTotalLabel: {
    font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true, readingOrder: 2 },
    border: GRAND_BORDER,
  },
  grandTotalFormula: {
    font: { name: FONT_NAME, sz: 11, bold: true, color: { rgb: '34D399' } },
    fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: GRAND_BORDER,
    numFmt: '#,##0.##',
  },
};

function strCell(v: string, s: CellStyle): StyledCell {
  return { v, t: 's', s };
}

function numCell(v: number, s: CellStyle): StyledCell {
  return { v, t: 'n', s };
}

function formulaCell(f: string, s: CellStyle): StyledCell {
  return { f, t: 'n', s };
}

function estimateRowHeight(texts: string[], colChars: number, minHeight = 26): number {
  let maxLines = 1;
  for (const t of texts) {
    if (!t) continue;
    const explicitLines = t.split('\n');
    let count = 0;
    for (const line of explicitLines) {
      count += Math.max(1, Math.ceil(line.length / Math.max(8, colChars)));
    }
    if (count > maxLines) maxLines = count;
  }
  return Math.max(minHeight, Math.min(120, maxLines * 17 + 10));
}

export function exportProjectToExcel(project: Project): void {
  const wb = XLSX.utils.book_new();
  const customCols = collectProjectCustomColumns(project);

  // =========================================================================
  // WORKSHEET 1: تفاصيل الفراغات
  // Exact Right-to-Left Column Order (Columns 1 to 37):
  // 1. البناء | 2. الفراغ | 3. الطول | 4. العرض | 5. الارتفاع
  // 6..35: Exact 30 standard BOQ columns
  // 36+: Dynamic columns for Quick Contingency Items
  // Last (37+): ملاحظات الفراغ
  // =========================================================================
  const fixedHeaders = ['البناء', 'الفراغ', 'الطول', 'العرض', 'الارتفاع'];
  const boqHeaders = STANDARD_BOQ_COLUMNS.map((c) => c.label);
  const customHeaders = customCols.map((c) => `${c.name}\n(${c.unit})`);
  const headers = [...fixedHeaders, ...boqHeaders, ...customHeaders, 'ملاحظات الفراغ'];

  const totalCols = headers.length;
  const qtyStartCol = fixedHeaders.length; // 5 (Column F = جلي أرضيات)
  const qtyEndCol = qtyStartCol + STANDARD_BOQ_COLUMNS.length + customCols.length - 1;

  const ws1Rows: StyledCell[][] = [];
  const ws1RowHeights: { hpt: number }[] = [];
  const ws1Merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  // Row 0: Merged Title Banner
  const titleRow: StyledCell[] = Array.from({ length: totalCols }, (_, i) =>
    strCell(
      i === 0 ? `تقرير حصر الكميات الهندسي (BOQ) — ${project.name || 'مشروع تأهيل'}` : '',
      STYLES.titleBanner
    )
  );
  ws1Rows.push(titleRow);
  ws1RowHeights.push({ hpt: 36 });
  ws1Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(11, totalCols - 1) } });

  // Row 1: Project Metadata Bar
  const metaRow: StyledCell[] = [
    strCell('اسم المشروع', STYLES.metaLabel),
    strCell(project.name || '-', STYLES.metaValue),
    strCell('الموقع', STYLES.metaLabel),
    strCell(project.location || '-', STYLES.metaValue),
    strCell('', STYLES.metaValue),
    strCell('التاريخ', STYLES.metaLabel),
    strCell(project.date || '-', STYLES.metaValue),
    strCell('', STYLES.metaValue),
  ];
  ws1Rows.push(metaRow);
  ws1RowHeights.push({ hpt: 26 });
  ws1Merges.push({ s: { r: 1, c: 3 }, e: { r: 1, c: 4 } });
  ws1Merges.push({ s: { r: 1, c: 6 }, e: { r: 1, c: 7 } });

  // Row 2: Spacer
  ws1Rows.push([]);
  ws1RowHeights.push({ hpt: 10 });

  // Row 3: Column Headers (tall wrapped row so long Arabic labels stack neatly)
  ws1Rows.push(
    headers.map((h, i) =>
      strCell(h, i < 5 ? STYLES.tableHeaderHighlight : STYLES.tableHeader)
    )
  );
  ws1RowHeights.push({ hpt: 44 });

  // Row 4: Units Reference Row
  const unitsText = [
    '',
    'الوحدة',
    'م',
    'م',
    'م',
    ...STANDARD_BOQ_COLUMNS.map((c) => c.unit),
    ...customCols.map((c) => c.unit),
    '',
  ];
  ws1Rows.push(unitsText.map((u) => strCell(u, STYLES.unitsHeader)));
  ws1RowHeights.push({ hpt: 22 });

  const blockSubtotalRowMap: { blockName: string; excelRow: number }[] = [];

  for (const block of project.blocks) {
    const blockStartExcelRow = ws1Rows.length + 1;
    let rowCounter = 0;

    for (const floor of block.floors) {
      for (const space of floor.spaces) {
        const zebra = rowCounter % 2 === 1;
        rowCounter++;

        const calc = calculateSpace(space);
        const multSuffix = calc.multiplier > 1 ? ` (×${calc.multiplier})` : '';
        const subSuffix =
          space.spaceType === 'bathrooms'
            ? `\n[${space.subRooms.length} فراغات فرعية]`
            : '';
        const spaceTitle = `${floor.name} - ${space.name}${multSuffix}${subSuffix}`;

        const row: StyledCell[] = [
          strCell(block.name, STYLES.blockNameCell(zebra)),
          strCell(spaceTitle, STYLES.textCell(zebra)),
          numCell(round2(safeNum(space.length)), STYLES.dimCell(zebra)),
          numCell(round2(safeNum(space.width)), STYLES.dimCell(zebra)),
          numCell(round2(safeNum(space.height)), STYLES.dimCell(zebra)),
        ];

        for (const col of STANDARD_BOQ_COLUMNS) {
          const val = round2(calc.boq[col.key]);
          row.push(numCell(val > 0 ? val : 0, STYLES.qtyCell(zebra, val > 0)));
        }
        for (const c of customCols) {
          const val = round2(calc.boq.custom[c.key] || 0);
          row.push(numCell(val > 0 ? val : 0, STYLES.qtyCell(zebra, val > 0)));
        }

        const noteParts: string[] = [];
        if (space.note.trim()) noteParts.push(space.note.trim());
        if (calc.multiplier > 1) {
          noteParts.push(`عدد الفراغات المتماثلة: ${calc.multiplier}`);
        }
        if (space.spaceType === 'bathrooms' && space.subRooms.length > 0) {
          const resolved = resolveEffectiveSubRooms(space.subRooms);
          const dimsStr = resolved
            .map((sr) => `${sr.label}: ${sr.length}×${sr.width}×${sr.height}م`)
            .join(' | ');
          noteParts.push(`فراغات فرعية (${resolved.length}): ${dimsStr}`);
        }
        const finalNote = noteParts.join('\n');
        row.push(strCell(finalNote, STYLES.textCell(zebra)));

        ws1Rows.push(row);
        ws1RowHeights.push({
          hpt: Math.max(
            estimateRowHeight([spaceTitle], 22, 26),
            estimateRowHeight([finalNote], 28, 26)
          ),
        });
      }
    }

    // Block General Works Row
    const gw = calculateBlockGeneralWorks(block);
    const hasGw =
      gw.boq.roofWaterproofing > 0 ||
      gw.boq.roofTiles > 0 ||
      gw.boq.tyrolean > 0 ||
      Object.keys(gw.boq.custom).length > 0;

    if (hasGw || ws1Rows.length + 1 === blockStartExcelRow) {
      const zebra = rowCounter % 2 === 1;
      const gwNote =
        block.generalWorks.deductExteriorOpenings && gw.boq.tyrolean > 0
          ? 'الرشة التيرولية محسوبة بعد خصم الفتحات الخارجية'
          : '';
      const gwRow: StyledCell[] = [
        strCell(block.name, STYLES.blockNameCell(zebra)),
        strCell('الأعمال الكلية للكتلة', STYLES.textCell(zebra)),
        strCell('-', STYLES.dimCell(zebra)),
        strCell('-', STYLES.dimCell(zebra)),
        strCell('-', STYLES.dimCell(zebra)),
      ];

      for (const col of STANDARD_BOQ_COLUMNS) {
        const val = round2(gw.boq[col.key]);
        gwRow.push(numCell(val > 0 ? val : 0, STYLES.qtyCell(zebra, val > 0)));
      }
      for (const c of customCols) {
        const val = round2(gw.boq.custom[c.key] || 0);
        gwRow.push(numCell(val > 0 ? val : 0, STYLES.qtyCell(zebra, val > 0)));
      }
      gwRow.push(strCell(gwNote, STYLES.textCell(zebra)));
      ws1Rows.push(gwRow);
      ws1RowHeights.push({ hpt: estimateRowHeight([gwNote], 28, 26) });
    }

    const blockEndExcelRow = ws1Rows.length;
    const subtotalExcelRow = ws1Rows.length + 1;

    // Highlighted Block Subtotal Row with live Excel =SUM(...) formulas
    const subtotalRow: StyledCell[] = [
      strCell('إجمالي الكتلة', STYLES.subtotalLabel),
      strCell(block.name, STYLES.subtotalLabel),
      strCell('', STYLES.subtotalLabel),
      strCell('', STYLES.subtotalLabel),
      strCell('', STYLES.subtotalLabel),
    ];
    for (let cIdx = qtyStartCol; cIdx <= qtyEndCol; cIdx++) {
      const colL = colLetter(cIdx);
      subtotalRow.push(
        formulaCell(`SUM(${colL}${blockStartExcelRow}:${colL}${blockEndExcelRow})`, STYLES.subtotalFormula)
      );
    }
    subtotalRow.push(strCell('', STYLES.subtotalLabel));
    ws1Rows.push(subtotalRow);
    ws1RowHeights.push({ hpt: 30 });

    blockSubtotalRowMap.push({ blockName: block.name, excelRow: subtotalExcelRow });

    // Dedicated row underneath subtotal for ملاحظات البناء العامة (merged cleanly!)
    if (block.generalNotes.trim()) {
      const noteRowIdx = ws1Rows.length;
      const noteText = `${block.name}: ${block.generalNotes.trim()}`;
      const noteRow: StyledCell[] = [
        strCell('ملاحظات البناء العامة', STYLES.noteLabel),
        ...Array.from({ length: Math.min(11, totalCols - 1) }, (_, idx) =>
          strCell(idx === 0 ? noteText : '', STYLES.noteContent)
        ),
      ];
      ws1Rows.push(noteRow);
      ws1Merges.push({
        s: { r: noteRowIdx, c: 1 },
        e: { r: noteRowIdx, c: Math.min(11, totalCols - 1) },
      });
      ws1RowHeights.push({ hpt: estimateRowHeight([noteText], 85, 28) });
    }

    // Spacer row between blocks
    ws1Rows.push([]);
    ws1RowHeights.push({ hpt: 12 });
  }

  // Grand Total Row at bottom of Worksheet 1
  if (blockSubtotalRowMap.length > 0) {
    const grandRow: StyledCell[] = [
      strCell('الإجمالي العام للمشروع', STYLES.grandTotalLabel),
      strCell(project.name || '-', STYLES.grandTotalLabel),
      strCell('', STYLES.grandTotalLabel),
      strCell('', STYLES.grandTotalLabel),
      strCell('', STYLES.grandTotalLabel),
    ];
    for (let cIdx = qtyStartCol; cIdx <= qtyEndCol; cIdx++) {
      const colL = colLetter(cIdx);
      const refs = blockSubtotalRowMap.map((b) => `${colL}${b.excelRow}`).join('+');
      grandRow.push(formulaCell(refs, STYLES.grandTotalFormula));
    }
    grandRow.push(strCell('', STYLES.grandTotalLabel));
    ws1Rows.push(grandRow);
    ws1RowHeights.push({ hpt: 34 });
  }

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Rows);
  ws1['!views'] = [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 5 }];
  ws1['!merges'] = ws1Merges;
  ws1['!rows'] = ws1RowHeights;
  ws1['!cols'] = Array.from({ length: totalCols }, (_, i) => {
    if (i === 0) return { wch: 20 }; // البناء
    if (i === 1) return { wch: 28 }; // الفراغ
    if (i >= 2 && i <= 4) return { wch: 9.5 }; // الطول العرض الارتفاع
    if (i === totalCols - 1) return { wch: 34 }; // ملاحظات الفراغ
    return { wch: 13.5 }; // compact balanced width so wrapped 2-line Arabic headers look crisp
  });

  XLSX.utils.book_append_sheet(wb, ws1, 'تفاصيل الفراغات');

  // =========================================================================
  // WORKSHEET 2: الخلاصة الإجمالية
  // =========================================================================
  const currency = project.currency || 'USD';
  const summaryHeaders: string[] = [
    'م',
    'البند',
    'الوحدة',
    ...blockSubtotalRowMap.map((b) => b.blockName),
    'الإجمالي الكلي',
    `السعر الإفرادي\n(${currency})`,
    `السعر الإجمالي\n(${currency})`,
  ];
  const ws2TotalCols = summaryHeaders.length;

  const ws2Rows: StyledCell[][] = [];
  const ws2RowHeights: { hpt: number }[] = [];
  const ws2Merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  // Row 0: Merged Title Banner
  ws2Rows.push(
    Array.from({ length: ws2TotalCols }, (_, i) =>
      strCell(
        i === 0 ? `الخلاصة الإجمالية لجدول الكميات (BOQ) — ${project.name || 'مشروع تأهيل'}` : '',
        STYLES.titleBanner
      )
    )
  );
  ws2RowHeights.push({ hpt: 36 });
  ws2Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: ws2TotalCols - 1 } });

  // Row 1: Meta bar
  ws2Rows.push([
    strCell('الموقع', STYLES.metaLabel),
    strCell(project.location || '-', STYLES.metaValue),
    strCell('التاريخ', STYLES.metaLabel),
    strCell(project.date || '-', STYLES.metaValue),
    ...Array.from({ length: Math.max(0, ws2TotalCols - 4) }, () =>
      strCell('', STYLES.metaValue)
    ),
  ]);
  ws2RowHeights.push({ hpt: 26 });
  if (ws2TotalCols > 4) {
    ws2Merges.push({ s: { r: 1, c: 3 }, e: { r: 1, c: ws2TotalCols - 1 } });
  }

  // Row 2: Spacer
  ws2Rows.push([]);
  ws2RowHeights.push({ hpt: 10 });

  // Row 3: Summary Table Headers
  const firstBlockColIdx = 3;
  const lastBlockColIdx = firstBlockColIdx + blockSubtotalRowMap.length - 1;
  const totalQtyColIdx = lastBlockColIdx + 1;
  const unitPriceColIdx = totalQtyColIdx + 1;
  const totalCostColIdx = unitPriceColIdx + 1;

  ws2Rows.push(
    summaryHeaders.map((h, i) =>
      strCell(
        h,
        i === totalQtyColIdx || i === totalCostColIdx
          ? STYLES.tableHeaderHighlight
          : STYLES.tableHeader
      )
    )
  );
  ws2RowHeights.push({ hpt: 40 });

  const firstItemExcelRow = ws2Rows.length + 1;

  const allItems: { key: string; label: string; unit: string; sheet1ColIdx: number }[] = [
    ...STANDARD_BOQ_COLUMNS.map((c, idx) => ({
      key: c.key,
      label: c.label,
      unit: c.unit,
      sheet1ColIdx: qtyStartCol + idx,
    })),
    ...customCols.map((c, idx) => ({
      key: c.key,
      label: c.name,
      unit: c.unit,
      sheet1ColIdx: qtyStartCol + STANDARD_BOQ_COLUMNS.length + idx,
    })),
  ];

  allItems.forEach((item, idx) => {
    const zebra = idx % 2 === 1;
    const excelRow = ws2Rows.length + 1;
    const sheet1ColL = colLetter(item.sheet1ColIdx);

    const row: StyledCell[] = [
      numCell(idx + 1, STYLES.dimCell(zebra)),
      strCell(item.label, STYLES.textCell(zebra)),
      strCell(item.unit, STYLES.unitsHeader),
    ];

    for (const b of blockSubtotalRowMap) {
      row.push(formulaCell(`'تفاصيل الفراغات'!${sheet1ColL}${b.excelRow}`, STYLES.qtyCell(zebra, true)));
    }

    if (blockSubtotalRowMap.length > 0) {
      row.push(
        formulaCell(
          `SUM(${colLetter(firstBlockColIdx)}${excelRow}:${colLetter(lastBlockColIdx)}${excelRow})`,
          STYLES.summaryTotalCol(zebra)
        )
      );
    } else {
      row.push(numCell(0, STYLES.summaryTotalCol(zebra)));
    }

    const unitPrice = round2(safeNum(project.unitPrices[item.key]));
    row.push(numCell(unitPrice, STYLES.qtyCell(zebra, unitPrice > 0)));
    row.push(
      formulaCell(
        `${colLetter(totalQtyColIdx)}${excelRow}*${colLetter(unitPriceColIdx)}${excelRow}`,
        STYLES.summaryTotalCol(zebra)
      )
    );

    ws2Rows.push(row);
    ws2RowHeights.push({ hpt: estimateRowHeight([item.label], 24, 24) });
  });

  const lastItemExcelRow = ws2Rows.length;

  // Grand Cost Total Row
  const costRowIdx = ws2Rows.length;
  const costSummaryRow: StyledCell[] = [
    strCell('', STYLES.grandTotalLabel),
    strCell('التكلفة التقديرية الإجمالية للمشروع', STYLES.grandTotalLabel),
    strCell(currency, STYLES.grandTotalLabel),
    ...blockSubtotalRowMap.map(() => strCell('', STYLES.grandTotalLabel)),
    strCell('', STYLES.grandTotalLabel),
    strCell('', STYLES.grandTotalLabel),
    lastItemExcelRow >= firstItemExcelRow
      ? formulaCell(
          `SUM(${colLetter(totalCostColIdx)}${firstItemExcelRow}:${colLetter(
            totalCostColIdx
          )}${lastItemExcelRow})`,
          STYLES.grandTotalFormula
        )
      : numCell(0, STYLES.grandTotalFormula),
  ];
  ws2Rows.push(costSummaryRow);
  ws2RowHeights.push({ hpt: 34 });
  if (totalCostColIdx > 2) {
    ws2Merges.push({ s: { r: costRowIdx, c: 3 }, e: { r: costRowIdx, c: totalCostColIdx - 1 } });
  }

  // Spacer + ملاحظات الموقع العامة box at bottom
  ws2Rows.push([]);
  ws2RowHeights.push({ hpt: 12 });

  const siteNoteRowIdx = ws2Rows.length;
  const siteNotesText = project.generalNotes.trim() || 'لا توجد ملاحظات عامة مسجّلة للموقع.';
  ws2Rows.push([
    strCell('ملاحظات الموقع العامة', STYLES.noteLabel),
    ...Array.from({ length: ws2TotalCols - 1 }, (_, i) =>
      strCell(i === 0 ? siteNotesText : '', STYLES.noteContent)
    ),
  ]);
  ws2Merges.push({ s: { r: siteNoteRowIdx, c: 1 }, e: { r: siteNoteRowIdx, c: ws2TotalCols - 1 } });
  ws2RowHeights.push({ hpt: estimateRowHeight([siteNotesText], 70, 34) });

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Rows);
  ws2['!views'] = [{ rightToLeft: true, state: 'frozen', xSplit: 3, ySplit: 4 }];
  ws2['!merges'] = ws2Merges;
  ws2['!rows'] = ws2RowHeights;
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 10 },
    ...blockSubtotalRowMap.map(() => ({ wch: 18 })),
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'الخلاصة الإجمالية');

  const safeProjectName = (project.name || 'BOQ_Report').replace(/[\\/:*?"<>|]/g, '_');
  const datePart = project.date || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeProjectName}_${datePart}.xlsx`);
}

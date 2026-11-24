import * as XLSX from 'xlsx';
import { Project } from '../types/boq';
import {
  calculateBlockGeneralWorks,
  calculateSpace,
  collectProjectCustomColumns,
  round2,
  safeNum,
  STANDARD_BOQ_COLUMNS,
} from '../utils/calculations';

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
  const customHeaders = customCols.map((c) => `${c.name} (${c.unit})`);
  const headers = [...fixedHeaders, ...boqHeaders, ...customHeaders, 'ملاحظات الفراغ'];

  const totalCols = headers.length;
  const qtyStartCol = fixedHeaders.length; // 5 (Column F = جلي أرضيات)
  const qtyEndCol = qtyStartCol + STANDARD_BOQ_COLUMNS.length + customCols.length - 1;

  const ws1Data: (string | number | { f: string; t?: string })[][] = [];

  // Project metadata header rows
  ws1Data.push([
    'اسم المشروع:',
    project.name || '-',
    'الموقع:',
    project.location || '-',
    'التاريخ:',
    project.date || '-',
  ]);
  ws1Data.push([]); // Spacer row
  ws1Data.push(headers);

  // Units reference sub-header row (helps site reviewers immediately read m² / kg / m.l. / count)
  const unitsRow: string[] = [
    '',
    '',
    'م',
    'م',
    'م',
    ...STANDARD_BOQ_COLUMNS.map((c) => c.unit),
    ...customCols.map((c) => c.unit),
    '',
  ];
  ws1Data.push(unitsRow);

  // Track each block subtotal row (1-based Excel row index) for Grand Total & Worksheet 2 formulas
  const blockSubtotalRowMap: { blockName: string; excelRow: number }[] = [];

  for (const block of project.blocks) {
    const blockStartExcelRow = ws1Data.length + 1;

    for (const floor of block.floors) {
      for (const space of floor.spaces) {
        const calc = calculateSpace(space);
        const multSuffix = calc.multiplier > 1 ? ` (×${calc.multiplier})` : '';
        const subSuffix =
          space.spaceType === 'bathrooms'
            ? ` [${space.subRooms.length} فراغات فرعية]`
            : '';
        const spaceTitle = `${floor.name} - ${space.name}${subSuffix}${multSuffix}`;

        const dimL = space.spaceType === 'bathrooms' ? '-' : round2(safeNum(space.length));
        const dimW = space.spaceType === 'bathrooms' ? '-' : round2(safeNum(space.width));
        const dimH = space.spaceType === 'bathrooms' ? '-' : round2(safeNum(space.height));

        const row: (string | number)[] = [block.name, spaceTitle, dimL, dimW, dimH];

        for (const col of STANDARD_BOQ_COLUMNS) {
          const val = round2(calc.boq[col.key]);
          row.push(val > 0 ? val : 0);
        }
        for (const c of customCols) {
          const val = round2(calc.boq.custom[c.key] || 0);
          row.push(val > 0 ? val : 0);
        }

        const noteParts: string[] = [];
        if (space.note.trim()) noteParts.push(space.note.trim());
        if (calc.multiplier > 1) {
          noteParts.push(`عدد الفراغات المتماثلة: ${calc.multiplier}`);
        }
        if (space.spaceType === 'bathrooms' && space.subRooms.length > 0) {
          const dimsStr = space.subRooms
            .map((sr) => `${sr.label}: ${sr.length}×${sr.width}×${sr.height}`)
            .join(' | ');
          noteParts.push(dimsStr);
        }
        row.push(noteParts.join(' — '));
        ws1Data.push(row);
      }
    }

    // Add Block General Works row if any block-level values exist (or if block has no spaces yet)
    const gw = calculateBlockGeneralWorks(block);
    const hasGw =
      gw.boq.roofWaterproofing > 0 ||
      gw.boq.roofTiles > 0 ||
      gw.boq.tyrolean > 0 ||
      Object.keys(gw.boq.custom).length > 0;

    if (hasGw || ws1Data.length + 1 === blockStartExcelRow) {
      const gwRow: (string | number)[] = [block.name, 'الأعمال الكلية للكتلة', '-', '-', '-'];
      for (const col of STANDARD_BOQ_COLUMNS) {
        const val = round2(gw.boq[col.key]);
        gwRow.push(val > 0 ? val : 0);
      }
      for (const c of customCols) {
        const val = round2(gw.boq.custom[c.key] || 0);
        gwRow.push(val > 0 ? val : 0);
      }
      gwRow.push(
        block.generalWorks.deductExteriorOpenings && gw.boq.tyrolean > 0
          ? 'الرشة التيرولية محسوبة بعد خصم الفتحات الخارجية'
          : ''
      );
      ws1Data.push(gwRow);
    }

    const blockEndExcelRow = ws1Data.length;
    const subtotalExcelRow = ws1Data.length + 1;

    // Highlighted Block Subtotal Row using real dynamic Excel =SUM(...) formulas
    const subtotalRow: (string | number | { f: string })[] = [
      'إجمالي الكتلة',
      block.name,
      '',
      '',
      '',
    ];
    for (let cIdx = qtyStartCol; cIdx <= qtyEndCol; cIdx++) {
      const colL = colLetter(cIdx);
      subtotalRow.push({ f: `SUM(${colL}${blockStartExcelRow}:${colL}${blockEndExcelRow})` });
    }
    subtotalRow.push('');
    ws1Data.push(subtotalRow);

    blockSubtotalRowMap.push({ blockName: block.name, excelRow: subtotalExcelRow });

    // Dedicated row directly underneath showing ملاحظات البناء العامة if present
    if (block.generalNotes.trim()) {
      ws1Data.push(['ملاحظات البناء العامة', `${block.name}: ${block.generalNotes.trim()}`]);
    }

    // Spacer row between blocks
    ws1Data.push([]);
  }

  // Grand Total Row at bottom of Worksheet 1 using live Excel formula summing block subtotals
  if (blockSubtotalRowMap.length > 0) {
    const grandRow: (string | number | { f: string })[] = [
      'الإجمالي العام للمشروع',
      project.name || '-',
      '',
      '',
      '',
    ];
    for (let cIdx = qtyStartCol; cIdx <= qtyEndCol; cIdx++) {
      const colL = colLetter(cIdx);
      const refs = blockSubtotalRowMap.map((b) => `${colL}${b.excelRow}`).join('+');
      grandRow.push({ f: refs });
    }
    grandRow.push('');
    ws1Data.push(grandRow);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!views'] = [{ rightToLeft: true }];
  ws1['!cols'] = Array.from({ length: totalCols }, (_, i) => {
    if (i === 0) return { wch: 22 };
    if (i === 1) return { wch: 30 };
    if (i >= 2 && i <= 4) return { wch: 10 };
    if (i === totalCols - 1) return { wch: 36 };
    return { wch: 15 };
  });

  XLSX.utils.book_append_sheet(wb, ws1, 'تفاصيل الفراغات');

  // =========================================================================
  // WORKSHEET 2: الخلاصة الإجمالية
  // Each Block as a column, all BOQ items (standard + custom), unit,
  // grand total across blocks, optional unit/total price, and ملاحظات الموقع العامة at bottom
  // =========================================================================
  const ws2Data: (string | number | { f: string })[][] = [];
  ws2Data.push([
    'الخلاصة الإجمالية لجدول الكميات (BOQ)',
    project.name || '-',
    'الموقع:',
    project.location || '-',
    'التاريخ:',
    project.date || '-',
  ]);
  ws2Data.push([]);

  const currency = project.currency || 'USD';
  const summaryHeader: string[] = [
    'م',
    'البند',
    'الوحدة',
    ...blockSubtotalRowMap.map((b) => b.blockName),
    'الإجمالي الكلي',
    `السعر الإفرادي (${currency})`,
    `السعر الإجمالي (${currency})`,
  ];
  ws2Data.push(summaryHeader);

  const firstBlockColIdx = 3; // Column D
  const lastBlockColIdx = firstBlockColIdx + blockSubtotalRowMap.length - 1;
  const totalQtyColIdx = lastBlockColIdx + 1;
  const unitPriceColIdx = totalQtyColIdx + 1;
  const totalCostColIdx = unitPriceColIdx + 1;

  const firstItemExcelRow = ws2Data.length + 1;

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
    const excelRow = ws2Data.length + 1;
    const sheet1ColL = colLetter(item.sheet1ColIdx);
    const row: (string | number | { f: string })[] = [idx + 1, item.label, item.unit];

    for (const b of blockSubtotalRowMap) {
      row.push({ f: `'تفاصيل الفراغات'!${sheet1ColL}${b.excelRow}` });
    }

    if (blockSubtotalRowMap.length > 0) {
      row.push({
        f: `SUM(${colLetter(firstBlockColIdx)}${excelRow}:${colLetter(lastBlockColIdx)}${excelRow})`,
      });
    } else {
      row.push(0);
    }

    const unitPrice = round2(safeNum(project.unitPrices[item.key]));
    row.push(unitPrice);
    row.push({
      f: `${colLetter(totalQtyColIdx)}${excelRow}*${colLetter(unitPriceColIdx)}${excelRow}`,
    });

    ws2Data.push(row);
  });

  const lastItemExcelRow = ws2Data.length;

  // Grand Cost Total Row
  const costSummaryRow: (string | number | { f: string })[] = [
    '',
    'التكلفة التقديرية الإجمالية للمشروع',
    currency,
    ...blockSubtotalRowMap.map(() => ''),
    '',
    '',
    lastItemExcelRow >= firstItemExcelRow
      ? {
          f: `SUM(${colLetter(totalCostColIdx)}${firstItemExcelRow}:${colLetter(
            totalCostColIdx
          )}${lastItemExcelRow})`,
        }
      : 0,
  ];
  ws2Data.push(costSummaryRow);

  // ملاحظات الموقع العامة at bottom of الخلاصة الإجمالية
  ws2Data.push([]);
  ws2Data.push([
    'ملاحظات الموقع العامة:',
    project.generalNotes.trim() || 'لا توجد ملاحظات عامة مسجّلة للموقع.',
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!views'] = [{ rightToLeft: true }];
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 10 },
    ...blockSubtotalRowMap.map(() => ({ wch: 18 })),
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'الخلاصة الإجمالية');

  const safeProjectName = (project.name || 'BOQ_Report').replace(/[\\/:*?"<>|]/g, '_');
  const datePart = project.date || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeProjectName}_${datePart}.xlsx`);
}

(() => {
  const cp1252 = { '€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159 };
  const byte = (char) => {
    const code = char.charCodeAt(0);
    if (code <= 255) return code;
    return cp1252[char] ?? 63;
  };
  const hex = (value) => [...String(value ?? '')].map((char) => byte(char).toString(16).padStart(2, '0')).join('').toUpperCase();
  const binary = (value) => Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 255));
  const normalize = (line) => typeof line === 'object' && line !== null ? { text: String(line.text ?? ''), bold: Boolean(line.bold), size: Number(line.size || 10), gap: Number(line.gap || 0), indent: Number(line.indent || 0) } : { text: String(line ?? ''), bold: false, size: 10, gap: 0, indent: 0 };
  const wrap = (line) => {
    const row = normalize(line);
    const width = Math.max(35, Math.floor(95 * (10 / row.size)) - row.indent);
    if (!row.text) return [row];
    const words = row.text.split(/\s+/);
    const rows = [];
    let current = '';
    for (const word of words) {
      if (!current) current = word;
      else if (`${current} ${word}`.length <= width) current += ` ${word}`;
      else { rows.push({ ...row, text: current }); current = word; }
    }
    if (current) rows.push({ ...row, text: current });
    return rows;
  };

  function pageStream(rows, page, totalPages) {
    const stream = ['BT'];
    let y = 795;
    for (const row of rows) {
      y -= row.gap;
      const font = row.bold ? 'F2' : 'F1';
      stream.push(`/${font} ${row.size} Tf`);
      stream.push(`1 0 0 1 ${50 + row.indent * 5} ${y} Tm`);
      stream.push(`<${hex(row.text)}> Tj`);
      y -= Math.max(12, row.size + 3);
    }
    stream.push('/F1 8 Tf');
    stream.push('1 0 0 1 50 25 Tm');
    stream.push(`<${hex(`EDM28 - Page ${page}/${totalPages}`)}> Tj`);
    stream.push('ET');
    return stream.join('\n');
  }

  function build(lines) {
    const rows = (lines || []).flatMap(wrap);
    const pages = [];
    let current = [];
    let height = 0;
    for (const row of rows) {
      const needed = Math.max(12, row.size + 3) + row.gap;
      if (current.length && height + needed > 735) { pages.push(current); current = []; height = 0; }
      current.push(row); height += needed;
    }
    pages.push(current.length ? current : [{ text: '', bold: false, size: 10, gap: 0, indent: 0 }]);

    const objects = [];
    const catalogId = 1;
    const pagesId = 2;
    objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    const pageIds = [];
    let nextId = 3;
    pages.forEach(() => { pageIds.push(nextId); nextId += 2; });
    const fontRegularId = nextId++;
    const fontBoldId = nextId++;
    objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    pages.forEach((rowsOnPage, index) => {
      const pageId = pageIds[index];
      const contentId = pageId + 1;
      const content = pageStream(rowsOnPage, index + 1, pages.length);
      objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });
    objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([binary(pdf)], { type: 'application/pdf' });
  }
  window.EDMPdfLite = { build };
})();
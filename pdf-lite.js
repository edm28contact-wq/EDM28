(() => {
  const escapePdf = (value) => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^ -~ -ÿ]/g, '?');

  function normalizeRows(input) {
    return (input || []).flatMap((entry) => {
      const row = typeof entry === 'object' && entry !== null
        ? { text: String(entry.text ?? ''), size: Number(entry.size || 9), bold: Boolean(entry.bold), gapBefore: Number(entry.gapBefore || 0) }
        : { text: String(entry ?? ''), size: 9, bold: false, gapBefore: 0 };
      const maxChars = row.size >= 16 ? 54 : row.size >= 12 ? 70 : 92;
      const chunks = [];
      if (!row.text) chunks.push('');
      for (let index = 0; index < row.text.length; index += maxChars) chunks.push(row.text.slice(index, index + maxChars));
      return chunks.map((text, index) => ({ ...row, text, gapBefore: index === 0 ? row.gapBefore : 0 }));
    }).slice(0, 82);
  }

  function build(lines) {
    const rows = normalizeRows(lines);
    const commands = ['BT', '48 800 Td'];
    let currentY = 800;

    for (const row of rows) {
      const lineHeight = Math.max(12, row.size + 4);
      const movement = lineHeight + Math.max(0, row.gapBefore);
      currentY -= movement;
      if (currentY < 45) break;
      commands.push(`0 -${movement} Td`);
      commands.push(`/${row.bold ? 'F2' : 'F1'} ${Math.max(7, Math.min(20, row.size))} Tf`);
      commands.push(`(${escapePdf(row.text)}) Tj`);
    }
    commands.push('ET');

    const content = commands.join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength ? Buffer.byteLength(content, 'latin1') : content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  window.EDMPdfLite = { build };
})();

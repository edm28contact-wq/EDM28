(() => {
  const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
  function build(lines) {
    const rows = (lines || []).flatMap((line) => {
      const text = String(line ?? '');
      const parts = [];
      for (let i = 0; i < text.length; i += 88) parts.push(text.slice(i, i + 88));
      return parts.length ? parts : [''];
    }).slice(0, 58);
    const stream = ['BT', '/F1 11 Tf', '50 790 Td', '14 TL'];
    rows.forEach((line, index) => {
      if (index) stream.push('T*');
      stream.push(`(${esc(line)}) Tj`);
    });
    stream.push('ET');
    const content = stream.join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((obj, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }
  window.EDMPdfLite = { build };
})();
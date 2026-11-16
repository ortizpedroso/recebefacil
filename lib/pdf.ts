function escapePdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const LINES_PER_PAGE = 45;

export function pdfDocument(lines: string[]) {
  const source = lines.length > 0 ? lines : [""];
  const pages: string[][] = [];
  for (let index = 0; index < source.length; index += LINES_PER_PAGE) pages.push(source.slice(index, index + LINES_PER_PAGE));
  const fontId = 3 + pages.length * 2;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] >> endobj`,
  ];
  pages.forEach((page, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const content = page.map((line, lineIndex) => `BT /F1 11 Tf 48 ${800 - lineIndex * 16} Td (${escapePdf(line)}) Tj ET`).join("\n");
    const length = Buffer.byteLength(content);
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj`,
      `${contentId} 0 obj << /Length ${length} >> stream\n${content}\nendstream endobj`,
    );
  });
  objects.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return body;
}

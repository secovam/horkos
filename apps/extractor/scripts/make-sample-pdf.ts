import { writeFile } from "node:fs/promises";

import { PDFDocument, StandardFonts } from "pdf-lib";

// Fictional text PDF to smoke-test the container: `node scripts/make-sample-pdf.ts out.pdf`.
const [output = "sample.pdf"] = process.argv.slice(2);

const pdf = await PDFDocument.create();

const font = await pdf.embedFont(StandardFonts.Helvetica);

const page = pdf.addPage();

const lines = [
  "Constancia de prueba",
  "RFC: XAXX010101000",
  "Nombre (s): MARIA FICTICIA",
];

for (const [index, line] of lines.entries()) {
  page.drawText(line, { x: 50, y: 700 - index * 24, size: 14, font });
}

await writeFile(output, await pdf.save());

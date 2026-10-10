import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildEmployeeSeed } from "../src/lib/employee-seed";

const output = fileURLToPath(
  new URL("../../../packages/db/seed/employees.sql", import.meta.url)
);

const [input] = process.argv.slice(2);

if (!input) {
  console.error("Uso: pnpm seed:employees <archivo.csv>");
  process.exit(1);
}

// pnpm runs scripts from the package root, so relative paths resolve from where the user typed them.
const csvPath = path.resolve(process.env.INIT_CWD ?? process.cwd(), input);

const { sql, issues, duplicates } = buildEmployeeSeed(
  await readFile(csvPath, "utf-8")
);

// Only line numbers and reasons are printed: the rows themselves are personal data.
for (const { line, reason } of duplicates) {
  console.warn(`Línea ${line} omitida: ${reason}`);
}

if (issues.length > 0) {
  for (const { line, reason } of issues) {
    console.error(`Línea ${line}: ${reason}`);
  }

  console.error(
    `No se escribió nada: corrige ${issues.length} línea(s) y vuelve a correr el comando.`
  );
  process.exit(1);
}

await writeFile(output, sql);

console.log(
  `Listo: ${sql.split("\n").length - 1} empleados en ${path.relative(process.cwd(), output)}`
);

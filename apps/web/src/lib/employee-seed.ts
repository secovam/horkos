import { newInvitationSchema } from "./invitation";

interface CsvRecord {
  line: number;
  fields: string[];
}

export interface SeedIssue {
  line: number;
  reason: string;
}

const EXPECTED_HEADER = ["nombre", "correo"];

// RFC 4180 fields with quotes, embedded commas and newlines; `line` is where each record starts.
function parseCsv(input: string): CsvRecord[] {
  const text = input.replace(/^﻿/u, "");
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  function endRecord() {
    fields.push(field);

    if (fields.some((value) => value.trim() !== "")) {
      records.push({ line: recordLine, fields });
    }

    fields = [];
    field = "";
    recordLine = line;
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "\n") {
      line += 1;
    }

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else if (char === "\n") {
      endRecord();
    } else if (char !== "\r") {
      field += char;
    }
  }

  endRecord();

  return records;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseRow(fields: string[]) {
  if (fields.length !== EXPECTED_HEADER.length) {
    return {
      ok: false as const,
      reason: `Se esperaban ${EXPECTED_HEADER.length} columnas y hay ${fields.length}`,
    };
  }

  const parsed = newInvitationSchema.safeParse({
    employeeName: fields[0],
    email: fields[1],
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      reason: parsed.error.issues.map(({ message }) => message).join("; "),
    };
  }

  return { ok: true as const, ...parsed.data };
}

export function buildEmployeeSeed(
  csv: string,
  newId: () => string = () => crypto.randomUUID()
) {
  const [header, ...rows] = parseCsv(csv);
  const issues: SeedIssue[] = [];
  const duplicates: SeedIssue[] = [];
  const statements: string[] = [];
  const firstLineByEmail = new Map<string, number>();

  const headerMatches =
    header?.fields.length === EXPECTED_HEADER.length &&
    header.fields.every(
      (value, index) => value.trim().toLowerCase() === EXPECTED_HEADER[index]
    );

  if (!headerMatches) {
    return {
      sql: "",
      duplicates,
      issues: [
        {
          line: header?.line ?? 1,
          reason: `El encabezado debe ser ${EXPECTED_HEADER.join(",")}`,
        },
      ],
    };
  }

  for (const { line, fields } of rows) {
    const row = parseRow(fields);
    const firstLine = row.ok ? firstLineByEmail.get(row.email) : undefined;

    if (!row.ok) {
      issues.push({ line, reason: row.reason });
    } else if (firstLine === undefined) {
      firstLineByEmail.set(row.email, line);
      statements.push(
        `INSERT INTO invitation (id, employee_name, email) VALUES (${sqlString(newId())}, ${sqlString(row.employeeName)}, ${sqlString(row.email)}) ON CONFLICT(email) DO NOTHING;`
      );
    } else {
      duplicates.push({
        line,
        reason: `Correo repetido, ya aparece en la línea ${firstLine}`,
      });
    }
  }

  return {
    sql: statements.length > 0 ? `${statements.join("\n")}\n` : "",
    duplicates,
    issues,
  };
}

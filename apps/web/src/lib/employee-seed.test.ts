import { describe, expect, test } from "vitest";

import { buildEmployeeSeed } from "./employee-seed";

function sequentialIds() {
  let next = 0;

  return () => {
    next += 1;

    return `id-${next}`;
  };
}

function seed(csv: string) {
  return buildEmployeeSeed(csv, sequentialIds());
}

function insert(id: string, name: string, email: string) {
  return `INSERT INTO invitation (id, employee_name, email) VALUES ('${id}', '${name}', '${email}') ON CONFLICT(email) DO NOTHING;`;
}

describe("buildEmployeeSeed", () => {
  test("writes an idempotent insert per row with a normalized name and email", () => {
    const result = seed(
      "nombre,correo\n  Ana Pérez  , ANA@Example.com \nLuis,luis@example.com\n"
    );

    expect(result.issues).toStrictEqual([]);
    expect(result.sql).toBe(
      `${insert("id-1", "Ana Pérez", "ana@example.com")}\n${insert("id-2", "Luis", "luis@example.com")}\n`
    );
  });

  test("keeps commas inside quoted names", () => {
    const result = seed('nombre,correo\n"Ramírez, Luis",luis@example.com\n');

    expect(result.sql).toBe(
      `${insert("id-1", "Ramírez, Luis", "luis@example.com")}\n`
    );
  });

  test("escapes apostrophes so a name cannot break out of the SQL string", () => {
    const result = seed(
      "nombre,correo\nSofía O'Brien,sofia@example.com\n\"x'); DROP TABLE invitation;--\",x@example.com\n"
    );

    expect(result.sql).toContain("'Sofía O''Brien'");
    expect(result.sql).toContain("'x''); DROP TABLE invitation;--'");
  });

  test("reads Excel exports with a BOM and CRLF line endings", () => {
    const result = seed(
      "﻿nombre,correo\r\nAna,ana@example.com\r\nLuis,luis@example.com\r\n"
    );

    expect(result.issues).toStrictEqual([]);
    expect(result.sql.trim().split("\n")).toHaveLength(2);
  });

  test("rejects a carriage return inside a field instead of dropping it", () => {
    const result = seed("nombre,correo\nAna,ana@exa\rmple.com\n");

    expect(result.sql).toBe("");
    expect(result.issues.map(({ line }) => line)).toStrictEqual([2]);
  });

  test("keeps the first of repeated emails, ignoring case, and reports the rest", () => {
    const result = seed(
      "nombre,correo\nAna,ana@example.com\nAna otra vez,ANA@example.com\n"
    );

    expect(result.sql).toBe(`${insert("id-1", "Ana", "ana@example.com")}\n`);
    expect(result.duplicates).toStrictEqual([
      { line: 3, reason: "Correo repetido, ya aparece en la línea 2" },
    ]);
    expect(result.issues).toStrictEqual([]);
  });

  test("reports invalid rows by line without echoing their data", () => {
    const result = seed(
      "nombre,correo\nAna,not-an-email\n,vacio@example.com\nLuis,luis@example.com,extra\nBea,bea@example.com\n"
    );

    expect(result.issues.map(({ line }) => line)).toStrictEqual([2, 3, 4]);
    expect(JSON.stringify(result.issues)).not.toMatch(
      /not-an-email|vacio|luis|extra/iu
    );
    expect(result.sql).toBe(`${insert("id-1", "Bea", "bea@example.com")}\n`);
  });

  test("counts lines past quoted fields that span several lines", () => {
    const result = seed(
      'nombre,correo\n"Ana\nPérez",ana@example.com\nLuis,roto\n'
    );

    expect(result.issues.map(({ line }) => line)).toStrictEqual([4]);
  });

  test("rejects a file whose header is not nombre,correo", () => {
    const result = seed("name,email\nAna,ana@example.com\n");

    expect(result.sql).toBe("");
    expect(result.issues).toHaveLength(1);
  });

  test("ignores blank lines", () => {
    const result = seed("nombre,correo\n\nAna,ana@example.com\n\n,\n");

    expect(result.issues).toStrictEqual([]);
    expect(result.sql.trim().split("\n")).toHaveLength(1);
  });
});

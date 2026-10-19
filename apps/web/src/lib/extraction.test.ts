import { describe, expect, it, test } from "vitest";

import { parseDocument, parseImssRegistration } from "./extraction";

const SAT_CONSTANCIA = `
# Constancia de Situación Fiscal

| RFC: | XAXX010101ABC |
| CURP: | FICM900101mdflcr08 |
| Nombre (s): | MARIA FERNANDA |
| Primer Apellido: | FICTICIA |
| Segundo Apellido: | PRUEBA |
`;

const IMSS_CONSTANCIA = `
Constancia de Vigencia de Derechos
Cadena original: Seguridad Social 12345678901
Curp FICM900101MDFLCR08
`;

const CFE_RECIBO = `
COMISIÓN FEDERAL DE ELECTRICIDAD
MARIA FICTICIA PRUEBA
###### CALLE FICTICIA 123 COLONIA DE PRUEBA C.P. 64000
RMU 123456789012
`;

const TELMEX_RECIBO = `
TELMEX
MARIA FICTICIA PRUEBA
CLL AVENIDA INVENTADA 45 FRACC SIN NOMBRE
C.P. 64010 MONTERREY NL
`;

const GENERIC_COMPROBANTE = `
Recibo emitido por CFE
Calle: Ejemplo Uno
Número Exterior: 12
Número Interior: S/N
Colonia: Centro de Prueba
Código Postal: 64020
Municipio: Monterrey
Estado: Nuevo León
`;

describe("parseDocument tax_status", () => {
  it("maps the SAT table to RFC, CURP and the full name", () => {
    const { fields, warnings } = parseDocument("tax_status", SAT_CONSTANCIA);

    expect(fields).toEqual({
      rfc: "XAXX010101ABC",
      curp: "FICM900101MDFLCR08",
      fullName: "Maria Fernanda Ficticia Prueba",
    });
    expect(warnings).toEqual([]);
  });

  it("drops an RFC that is not a person's RFC instead of prefilling it", () => {
    const company = SAT_CONSTANCIA.replace("XAXX010101ABC", "XAX010101ABC");

    expect(parseDocument("tax_status", company).fields).not.toHaveProperty(
      "rfc"
    );
    expect(parseDocument("tax_status", company).fields.curp).toBe(
      "FICM900101MDFLCR08"
    );
  });
});

describe("parseDocument imss", () => {
  it("reads the NSS and the CURP, and nothing the form does not ask for", () => {
    expect(parseDocument("imss", IMSS_CONSTANCIA).fields).toEqual({
      nss: "12345678901",
      curp: "FICM900101MDFLCR08",
    });
  });
});

describe("parseDocument proof_of_address", () => {
  it("splits a CFE address line into street, number and suburb", () => {
    const { fields, warnings } = parseDocument("proof_of_address", CFE_RECIBO);

    expect(fields).toEqual({
      street: "CALLE FICTICIA",
      extNumber: "123",
      suburb: "COLONIA DE PRUEBA",
      postalCode: "64000",
    });
    expect(warnings).toEqual([]);
  });

  it("splits a Telmex CLL line", () => {
    const { fields, warnings } = parseDocument(
      "proof_of_address",
      TELMEX_RECIBO
    );

    expect(fields).toEqual({
      street: "AVENIDA INVENTADA",
      extNumber: "45",
      suburb: "FRACC SIN NOMBRE",
      postalCode: "64010",
    });
    expect(warnings).toEqual([]);
  });

  it("reads labeled addresses and skips an interior number of S/N", () => {
    const { fields, warnings } = parseDocument(
      "proof_of_address",
      GENERIC_COMPROBANTE
    );

    expect(fields).toEqual({
      street: "Ejemplo Uno",
      extNumber: "12",
      suburb: "Centro de Prueba",
      postalCode: "64020",
      city: "Monterrey",
      state: "Nuevo León",
    });
    expect(warnings).toEqual([]);
  });

  it("warns when readable text is neither CFE nor Telmex, and still proposes the address", () => {
    const water = GENERIC_COMPROBANTE.replace("CFE", "el organismo de agua");
    const { fields, warnings } = parseDocument("proof_of_address", water);

    expect(warnings).toEqual(["not_cfe_or_telmex"]);
    expect(fields.postalCode).toBe("64020");
  });

  it("recognizes the issuer by its full name", () => {
    expect(
      parseDocument("proof_of_address", CFE_RECIBO).warnings
    ).not.toContain("not_cfe_or_telmex");
    expect(
      parseDocument(
        "proof_of_address",
        "Teléfonos de México\nCLL UNO 5 CENTRO C.P. 64000"
      ).warnings
    ).toEqual([]);
  });
});

// Fictional data in the layout LiteParse returns for an IDSE "Constancia de presentación de movimientos afiliatorios".
const IDSE_CONSTANCIA = `# Constancia de presentación de movimientos afiliatorios IMSS DESDE SU EMPRESA

Razón Social: EMPRESA FICTICIA SA DE CV

| Número de lote: | 100000001 |  |  |
|---|---|---|---|
| RFC del patrón: | EFI000101AB1 | Fecha y hora de recepción del lote: | 2026-03-20 08:17 |
| Registro Patronal: | Z0000000000 | Serial del certificado: | 00000100000200000001 |

Relación de movimientos operados

Tipo NSS Nombre Asegurado Sal. Base Ext. UMF Tipo Fec-Mov Tipo C. Baja

8 12345678901 PRUEBA FICTICIA MARIA $ 695.55 1 069 0 02/03/2026 1 0

Para efectos de lo anterior se entenderá por: Modif. (Modificación de salario), Reing. (Reingreso), Fec-Mov (Fecha de movimiento), NSS (Número de Seguridad Social), Sal. Base (Salario base).`;

describe("parseImssRegistration", () => {
  it("reads salary and movement date from an IDSE constancia", () => {
    expect(parseImssRegistration(IDSE_CONSTANCIA)).toEqual({
      dailySalary: "695.55",
      hireDate: "2026-03-02",
    });
  });

  test.each([
    ["Salario Diario: $ 695.55", "695.55"],
    ["Salario Diario Integrado | 695.55 |", "695.55"],
    ["Salario Base de Cotización: 1,234.5", "1234.50"],
    ["Salario base de cotizacion $ 400", "400.00"],
    ["SBC: 695.55", "695.55"],
    ["Importe $ 695.55 pesos", "695.55"],
  ])("reads the salary from %j", (text, dailySalary) => {
    expect(parseImssRegistration(text)).toEqual({ dailySalary });
  });

  it("reads the insured's row of a relación de movimientos operados", () => {
    const rows = `Relación de movimientos operados
Registro patronal Z0000000000
NSS Nombre Tipo Sal. Base
12345678901 FICTICIA PRUEBA MARIA ALTA $ 1,005.20`;

    expect(parseImssRegistration(rows)).toEqual({ dailySalary: "1005.20" });
  });

  it("prefers a labeled salary over any other amount", () => {
    const text = "Cuota $ 20.00\nSalario Diario: 695.55";

    expect(parseImssRegistration(text)).toEqual({ dailySalary: "695.55" });
  });

  it("proposes nothing when there is no amount", () => {
    expect(parseImssRegistration("Alta de trabajador sin importes")).toEqual(
      {}
    );
    expect(parseImssRegistration("Salario Diario: pendiente")).toEqual({});
  });

  it("drops a salary below the minimum the form accepts", () => {
    expect(parseImssRegistration("Salario Diario: $ 200.00")).toEqual({});
  });
});

describe("parseImssRegistration hire date", () => {
  const row = "12345678901 FICTICIA PRUEBA MARIA ALTA $ 695.55";

  test.each([
    ["Fecha de movimiento: 02/03/2026", "2026-03-02"],
    ["Fecha mov. | 2-3-2026 |", "2026-03-02"],
    ["FECHA DE ALTA 15/01/2026", "2026-01-15"],
    ["Fecha de reingreso: 31-12-2025", "2025-12-31"],
    ["Fecha de inicio: 01/02/2026", "2026-02-01"],
  ])("reads the labeled date %j", (text, hireDate) => {
    expect(parseImssRegistration(text)).toEqual({ hireDate });
  });

  it("prefers the labeled date over the row's date", () => {
    const text = `Fecha de movimiento: 02/03/2026\n${row} 05/03/2026`;

    expect(parseImssRegistration(text)).toMatchObject({
      hireDate: "2026-03-02",
    });
  });

  it("falls back to the first date on the insured's row", () => {
    const text = `Fecha de proceso 20/03/2026\nNSS Nombre Tipo Fecha\n12345678901 FICTICIA PRUEBA ALTA 02/03/2026 $ 695.55`;

    expect(parseImssRegistration(text)).toEqual({
      dailySalary: "695.55",
      hireDate: "2026-03-02",
    });
  });

  it("ignores an unlabeled date outside the insured's row", () => {
    const text = `Acuse de movimientos afiliatorios\n20/03/2026\n${row}`;

    expect(parseImssRegistration(text)).toEqual({ dailySalary: "695.55" });
  });

  it("proposes no date when the only date is a header date", () => {
    expect(
      parseImssRegistration(
        "Acuse de movimientos 20/03/2026\nSalario Diario: 695.55"
      )
    ).toEqual({ dailySalary: "695.55" });
  });

  it.each(["Fecha de movimiento: 31/02/2026", "Fecha de alta: 01/13/2026"])(
    "drops the impossible date %j",
    (text) => {
      expect(parseImssRegistration(text)).toEqual({});
    }
  );
});

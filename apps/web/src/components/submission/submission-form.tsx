import { Button } from "@horkos/ui/components/button";
import { Card, CardContent } from "@horkos/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@horkos/ui/components/field";
import { Input } from "@horkos/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useState } from "react";
import type { ComponentProps } from "react";

import {
  tourAnchor,
  useSubmissionTour,
} from "@/components/submission/submission-tour";
import { submitInvitation } from "@/functions/employee-invitation";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LIST,
  submissionFormSchema,
} from "@/lib/submission";
import type { DocumentKind, SubmissionInput } from "@/lib/submission";

interface TextFieldConfig {
  name: keyof SubmissionInput;
  label: string;
  autoComplete: string;
  inputMode?: ComponentProps<"input">["inputMode"];
  autoCapitalize?: string;
  maxLength?: number;
  hint?: string;
}

const PERSONAL_FIELDS: readonly TextFieldConfig[] = [
  {
    name: "fullName",
    label: "Nombre completo",
    autoComplete: "name",
    hint: "Como aparece en tu identificación oficial.",
  },
  {
    name: "rfc",
    label: "RFC",
    autoComplete: "off",
    autoCapitalize: "characters",
    maxLength: 13,
  },
  {
    name: "curp",
    label: "CURP",
    autoComplete: "off",
    autoCapitalize: "characters",
    maxLength: 18,
  },
  {
    name: "nss",
    label: "Número de seguridad social (NSS)",
    autoComplete: "off",
    inputMode: "numeric",
    maxLength: 11,
  },
];

const ADDRESS_FIELDS: readonly TextFieldConfig[] = [
  {
    name: "street",
    label: "Calle",
    autoComplete: "address-line1",
  },
  {
    name: "extNumber",
    label: "Número exterior",
    autoComplete: "off",
  },
  {
    name: "intNumber",
    label: "Número interior (opcional)",
    autoComplete: "off",
  },
  {
    name: "suburb",
    label: "Colonia",
    autoComplete: "address-level3",
  },
  {
    name: "postalCode",
    label: "Código postal",
    autoComplete: "postal-code",
    inputMode: "numeric",
    maxLength: 5,
  },
  {
    name: "city",
    label: "Municipio o alcaldía",
    autoComplete: "address-level2",
  },
  {
    name: "state",
    label: "Estado",
    autoComplete: "address-level1",
  },
];

const TEXT_SECTIONS = [
  { legend: "Datos personales", anchor: "personal", fields: PERSONAL_FIELDS },
  { legend: "Domicilio", anchor: "address", fields: ADDRESS_FIELDS },
] as const;

function TextInputField({
  field,
  label,
  autoComplete,
  inputMode,
  autoCapitalize,
  maxLength,
  hint,
}: Omit<TextFieldConfig, "name"> & { field: AnyFieldApi }) {
  const invalid = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type="text"
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        spellCheck={false}
        aria-invalid={invalid}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      <FieldError errors={field.state.meta.errors} />
    </Field>
  );
}

const NO_FILES: Record<DocumentKind, File | null> = {
  tax_status: null,
  imss: null,
  proof_of_address: null,
};

export function SubmissionForm({
  token,
  employeeName,
  onSubmitted,
}: {
  token: string;
  employeeName: string;
  onSubmitted: () => void;
}) {
  const startTour = useSubmissionTour();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      fullName: employeeName,
      rfc: "",
      curp: "",
      nss: "",
      street: "",
      extNumber: "",
      intNumber: "",
      suburb: "",
      postalCode: "",
      city: "",
      state: "",
      files: NO_FILES,
    },
    validators: { onSubmit: submissionFormSchema },
    onSubmitInvalid: () => {
      document
        .querySelector<HTMLElement>('main [aria-invalid="true"]')
        ?.focus();
    },
    onSubmit: async ({ value }) => {
      const { files, ...fields } = value;
      const body = new FormData();
      body.set("token", token);

      for (const [name, text] of Object.entries(fields)) {
        body.set(name, text);
      }

      for (const kind of DOCUMENT_KIND_LIST) {
        const file = files[kind];

        if (file) {
          body.set(`file_${kind}`, file);
        }
      }

      setSubmitError(null);

      try {
        await submitInvitation({ data: body });
      } catch (error) {
        // Inline next to the button, where the person is looking, so the error cannot be missed.
        setSubmitError(
          error instanceof Error
            ? error.message
            : "No se pudo enviar tu información. Inténtalo de nuevo."
        );

        return;
      }

      onSubmitted();
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <header className="flex flex-col items-start gap-2">
        <div className="flex flex-col gap-2" {...tourAnchor("welcome")}>
          <h1 className="text-primary text-xl font-semibold text-balance">
            Completa tu información
          </h1>
          <p className="text-muted-foreground text-pretty">
            Sube tus documentos y revisa tus datos. Recursos Humanos los
            confirmará antes de preparar tu contrato.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={startTour}>
          ¿Cómo lleno esto?
        </Button>
      </header>

      <Card {...tourAnchor("documents")}>
        <CardContent>
          <FieldSet>
            <FieldLegend>Documentos</FieldLegend>
            <FieldDescription>PDF de hasta 10 MB.</FieldDescription>
            <FieldGroup>
              {DOCUMENT_KIND_LIST.map((kind) => (
                <form.Field key={kind} name={`files.${kind}`}>
                  {(field) => {
                    const invalid = field.state.meta.errors.length > 0;
                    const { label, hint } = DOCUMENT_KINDS[kind];
                    const chosen = field.state.value;

                    return (
                      <Field data-invalid={invalid}>
                        <FieldLabel htmlFor={`file-${kind}`}>
                          {label}
                        </FieldLabel>
                        <Input
                          id={`file-${kind}`}
                          name={`file_${kind}`}
                          type="file"
                          accept={DOCUMENT_ACCEPT}
                          aria-invalid={invalid}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.files?.[0] ?? null)
                          }
                        />
                        <FieldDescription>
                          {chosen
                            ? `Archivo elegido: ${chosen.name}. Elige otro para reemplazarlo.`
                            : hint}
                        </FieldDescription>
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    );
                  }}
                </form.Field>
              ))}
            </FieldGroup>
          </FieldSet>
        </CardContent>
      </Card>

      {TEXT_SECTIONS.map(({ legend, anchor, fields }) => (
        <Card key={legend} {...tourAnchor(anchor)}>
          <CardContent>
            <FieldSet>
              <FieldLegend>{legend}</FieldLegend>
              <FieldGroup>
                {fields.map(({ name, ...config }) => (
                  <form.Field key={name} name={name}>
                    {(field) => <TextInputField field={field} {...config} />}
                  </form.Field>
                ))}
              </FieldGroup>
            </FieldSet>
          </CardContent>
        </Card>
      ))}

      {submitError ? <FieldError>{submitError}</FieldError> : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            {...tourAnchor("submit")}
          >
            {isSubmitting ? "Enviando…" : "Enviar mi información"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

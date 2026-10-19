import { Alert, AlertDescription } from "@horkos/ui/components/alert";
import { Badge } from "@horkos/ui/components/badge";
import { Button } from "@horkos/ui/components/button";
import { Checkbox } from "@horkos/ui/components/checkbox";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@horkos/ui/components/dialog";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@horkos/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@horkos/ui/components/select";
import { toast } from "@horkos/ui/components/toast";
import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { saveEmployment, uploadImssRegistration } from "@/functions/employees";
import {
  COMPANY_LIST,
  DEPARTMENT_LIST,
  EMPLOYMENT_FIELDS,
  OFFICE_LIST,
  SEXES,
  SEX_LIST,
  WORK_EMAIL_DOMAIN,
  employmentSchema,
  formatSalary,
} from "@/lib/employment";
import type { EmploymentInput } from "@/lib/employment";
import type { ImssRegistrationResult } from "@/lib/extraction";
import {
  DOCUMENT_ACCEPT,
  HR_DOCUMENT_KINDS,
  parseDocumentFile,
} from "@/lib/submission";

type ImssUpload =
  | { status: "empty" }
  | { status: "uploading"; fileName: string }
  | {
      status: "uploaded";
      fileName: string;
      extraction: Pick<ImssRegistrationResult, "status" | "fields">;
    }
  | { status: "rejected"; message: string };

interface SavedImssRegistration {
  fileName: string;
  status: ImssRegistrationResult["status"];
  proposedSalary?: string;
}

const UPLOAD_ERROR_FALLBACK =
  "No se pudo subir el documento. Inténtalo de nuevo.";

function uploadFromServer(saved: SavedImssRegistration | null): ImssUpload {
  if (!saved) {
    return { status: "empty" };
  }

  return {
    status: "uploaded",
    fileName: saved.fileName,
    extraction: {
      status: saved.status,
      fields: { dailySalary: saved.proposedSalary },
    },
  };
}

function proposalOf(upload: ImssUpload) {
  return upload.status === "uploaded"
    ? upload.extraction.fields.dailySalary
    : undefined;
}

function describeUpload(upload: ImssUpload) {
  switch (upload.status) {
    case "uploading": {
      return "Subiendo y leyendo el documento…";
    }

    case "uploaded": {
      const proposal = proposalOf(upload);

      const read = proposal
        ? `Leído: ${formatSalary(proposal)}`
        : "No pudimos leer el salario, escríbelo a mano.";

      return `Ya subiste ${upload.fileName}. Elige otro para reemplazarlo. ${read}`;
    }

    default: {
      return null;
    }
  }
}

function uploadBadge(upload: ImssUpload) {
  switch (upload.status) {
    case "empty": {
      return { variant: "outline", label: "Pendiente" } as const;
    }

    case "uploading": {
      return { variant: "info", label: "Leyendo…" } as const;
    }

    case "rejected": {
      return { variant: "destructive", label: "Rechazado" } as const;
    }

    default: {
      return proposalOf(upload)
        ? ({ variant: "default", label: "Leído" } as const)
        : ({ variant: "secondary", label: "Sin leer" } as const);
    }
  }
}

function ImssRegistrationField({
  upload,
  onPick,
}: {
  upload: ImssUpload;
  onPick: (file: File) => void;
}) {
  const badge = uploadBadge(upload);
  const description = describeUpload(upload);
  const rejected = upload.status === "rejected";

  return (
    <Field data-invalid={rejected}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor="imss-registration">
          {HR_DOCUMENT_KINDS.imss_registration.label}
        </FieldLabel>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <Input
        id="imss-registration"
        type="file"
        accept={DOCUMENT_ACCEPT}
        aria-invalid={rejected}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onPick(file);
          }
        }}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {rejected ? <FieldError>{upload.message}</FieldError> : null}
    </Field>
  );
}

function SalaryField({
  field,
  proposal,
}: {
  field: AnyFieldApi;
  proposal?: string;
}) {
  const { errors } = field.state.meta;
  const differs = proposal !== undefined && proposal !== field.state.value;

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor="dailySalary">
        {EMPLOYMENT_FIELDS.dailySalary.label}
      </FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="dailySalary"
          name="dailySalary"
          inputMode="decimal"
          spellCheck={false}
          aria-invalid={errors.length > 0}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
        />
      </InputGroup>
      {differs ? (
        <FieldDescription>
          El alta del IMSS indica {formatSalary(proposal)}.
        </FieldDescription>
      ) : null}
      <FieldError errors={errors} />
    </Field>
  );
}

const DEPARTMENT_ITEMS = DEPARTMENT_LIST.map((value) => ({
  value,
  label: value,
}));

const OFFICE_ITEMS = OFFICE_LIST.map((value) => ({ value, label: value }));

const SEX_ITEMS = SEX_LIST.map((value) => ({
  value,
  label: SEXES[value].label,
}));

function SelectField({
  name,
  field,
  items,
}: {
  name: keyof EmploymentInput;
  field: AnyFieldApi;
  items: readonly { value: string; label: string }[];
}) {
  const { errors } = field.state.meta;

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={name}>{EMPLOYMENT_FIELDS[name].label}</FieldLabel>
      <Select
        name={name}
        items={items}
        value={field.state.value || null}
        onValueChange={(value) => field.handleChange(value ?? "")}
      >
        <SelectTrigger
          id={name}
          aria-invalid={errors.length > 0}
          onBlur={field.handleBlur}
        >
          <SelectValue placeholder="Elige una opción" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError errors={errors} />
    </Field>
  );
}

function TextField({
  name,
  field,
  type = "text",
}: {
  name: keyof EmploymentInput;
  field: AnyFieldApi;
  type?: "text" | "email" | "date";
}) {
  const { errors } = field.state.meta;

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={name}>{EMPLOYMENT_FIELDS[name].label}</FieldLabel>
      <Input
        id={name}
        name={name}
        type={type}
        spellCheck={false}
        aria-invalid={errors.length > 0}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      <FieldError errors={errors} />
    </Field>
  );
}

// The form holds the full address, so the domain is shown but never typed.
function WorkEmailField({ field }: { field: AnyFieldApi }) {
  const { errors } = field.state.meta;
  const value: string = field.state.value;

  const username = value.endsWith(WORK_EMAIL_DOMAIN)
    ? value.slice(0, -WORK_EMAIL_DOMAIN.length)
    : value;

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor="workEmail">
        {EMPLOYMENT_FIELDS.workEmail.label}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="workEmail"
          name="workEmail"
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={errors.length > 0}
          value={username}
          onBlur={field.handleBlur}
          onChange={(event) => {
            const typed = event.target.value.trim();

            field.handleChange(typed ? `${typed}${WORK_EMAIL_DOMAIN}` : "");
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{WORK_EMAIL_DOMAIN}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <FieldError errors={errors} />
    </Field>
  );
}

function CompaniesField({ field }: { field: AnyFieldApi }) {
  const { errors } = field.state.meta;
  const chosen: string[] = field.state.value;

  return (
    <FieldSet data-invalid={errors.length > 0}>
      <FieldLegend variant="label">
        {EMPLOYMENT_FIELDS.companies.label}
      </FieldLegend>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {COMPANY_LIST.map((company) => (
          <Field key={company} orientation="horizontal" className="w-auto">
            <Checkbox
              id={`company-${company}`}
              checked={chosen.includes(company)}
              aria-invalid={errors.length > 0}
              onCheckedChange={(checked) =>
                field.handleChange(
                  checked
                    ? [...chosen, company]
                    : chosen.filter((item) => item !== company)
                )
              }
            />
            <FieldLabel htmlFor={`company-${company}`}>{company}</FieldLabel>
          </Field>
        ))}
      </div>
      <FieldError errors={errors} />
    </FieldSet>
  );
}

export function EmploymentForm({
  invitationId,
  values,
  imssRegistration,
  onDone,
}: {
  invitationId: string;
  values: EmploymentInput;
  imssRegistration: SavedImssRegistration | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: EmploymentInput) =>
      saveEmployment({ data: { invitationId, fields: input } }),
    onSuccess: async () => {
      toast.success("Datos laborales guardados");
      await Promise.all([
        router.invalidate(),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
      ]);
      onDone();
    },
  });

  const [upload, setUpload] = useState(() =>
    uploadFromServer(imssRegistration)
  );

  // Newest pick wins, so a slow earlier answer cannot overwrite a later one.
  const latestUpload = useRef(0);

  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: values,
    validators: { onSubmit: employmentSchema },
    onSubmitInvalid: () => {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    },
    onSubmit: ({ value }) => save.mutate(value),
  });

  async function pick(file: File) {
    latestUpload.current += 1;
    const attempt = latestUpload.current;
    const previousProposal = proposalOf(upload);

    try {
      setUpload({ status: "uploading", fileName: file.name });

      const body = new FormData();
      body.set("invitationId", invitationId);
      body.set("file", parseDocumentFile(file));

      const uploaded = await uploadImssRegistration({ data: body });

      if (attempt !== latestUpload.current) {
        return;
      }

      setUpload({ status: "uploaded", ...uploaded });
      save.reset();

      const proposal = uploaded.extraction.fields.dailySalary;
      const typed = form.getFieldValue("dailySalary").trim();

      // HR's own figure stays; only an empty field or the last proposal makes room for the new one.
      if (proposal && (typed === "" || typed === previousProposal)) {
        form.setFieldValue("dailySalary", proposal);
      }
    } catch (error) {
      if (attempt === latestUpload.current) {
        setUpload({
          status: "rejected",
          message:
            error instanceof Error ? error.message : UPLOAD_ERROR_FALLBACK,
        });
      }
    }
  }

  return (
    <form
      ref={formRef}
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Datos laborales</DialogTitle>
        <DialogDescription>
          Completa lo que el empleado no puede proporcionar.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="workEmail">
          {(field) => <WorkEmailField field={field} />}
        </form.Field>
        <form.Field name="personalEmail">
          {(field) => (
            <TextField name="personalEmail" field={field} type="email" />
          )}
        </form.Field>
        <form.Field name="jobTitle">
          {(field) => <TextField name="jobTitle" field={field} />}
        </form.Field>
        <form.Field name="department">
          {(field) => (
            <SelectField
              name="department"
              field={field}
              items={DEPARTMENT_ITEMS}
            />
          )}
        </form.Field>
        <form.Field name="manager">
          {(field) => <TextField name="manager" field={field} />}
        </form.Field>
        <form.Field name="office">
          {(field) => (
            <SelectField name="office" field={field} items={OFFICE_ITEMS} />
          )}
        </form.Field>
        <form.Field name="companies">
          {(field) => <CompaniesField field={field} />}
        </form.Field>
        <form.Field name="nationality">
          {(field) => <TextField name="nationality" field={field} />}
        </form.Field>
        <form.Field name="sex">
          {(field) => (
            <SelectField name="sex" field={field} items={SEX_ITEMS} />
          )}
        </form.Field>
        <form.Field name="hireDate">
          {(field) => <TextField name="hireDate" field={field} type="date" />}
        </form.Field>
        <ImssRegistrationField upload={upload} onPick={pick} />
        <form.Field name="dailySalary">
          {(field) => (
            <SalaryField field={field} proposal={proposalOf(upload)} />
          )}
        </form.Field>
      </FieldGroup>

      {save.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{save.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={onDone}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

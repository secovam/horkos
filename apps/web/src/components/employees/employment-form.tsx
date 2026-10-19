import { Alert, AlertDescription } from "@horkos/ui/components/alert";
import { Badge } from "@horkos/ui/components/badge";
import { Button } from "@horkos/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@horkos/ui/components/combobox";
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

import { AutoExtractedBadge } from "@/components/extraction/auto-extracted-badge";
import { saveEmployment, uploadImssRegistration } from "@/functions/employees";
import {
  COMPANY_LIST,
  formatHireDate,
  DEPARTMENT_LIST,
  EMPLOYMENT_FIELDS,
  JOB_TITLE_LIST,
  SEXES,
  SEX_LIST,
  WORK_EMAIL_DOMAIN,
  employmentSchema,
  formatSalary,
} from "@/lib/employment";
import type { EmploymentInput } from "@/lib/employment";
import type { ImssProposals, ImssRegistrationResult } from "@/lib/extraction";
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
  proposals: ImssProposals;
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
      fields: saved.proposals,
    },
  };
}

// The fields the alta del IMSS can fill in, each with how to show its proposal.
const PROPOSAL_FORMATS = {
  dailySalary: formatSalary,
  hireDate: formatHireDate,
} satisfies Record<keyof ImssProposals, (value: string) => string>;

const PROPOSAL_NAMES = ["dailySalary", "hireDate"] as const;

function proposalsOf(upload: ImssUpload): ImssProposals {
  return upload.status === "uploaded" ? upload.extraction.fields : {};
}

function describeUpload(upload: ImssUpload) {
  switch (upload.status) {
    case "uploading": {
      return "Subiendo y leyendo el documento…";
    }

    case "uploaded": {
      const replace = `Ya subiste ${upload.fileName}. Elige otro para reemplazarlo.`;

      return proposalsOf(upload).dailySalary
        ? replace
        : `${replace} No pudimos leer el salario, escríbelo a mano.`;
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
      return proposalsOf(upload).dailySalary
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

// Shown only while HR's value differs from what the alta del IMSS indicates.
function ProposalHint({
  name,
  field,
  proposals,
}: {
  name: keyof ImssProposals;
  field: AnyFieldApi;
  proposals: ImssProposals;
}) {
  const proposal = proposals[name];

  if (proposal === undefined || proposal === field.state.value) {
    return null;
  }

  return (
    <FieldDescription>
      El alta del IMSS indica {PROPOSAL_FORMATS[name](proposal)}.
    </FieldDescription>
  );
}

function SalaryField({
  field,
  proposals,
}: {
  field: AnyFieldApi;
  proposals: ImssProposals;
}) {
  const { errors } = field.state.meta;

  return (
    <Field data-invalid={errors.length > 0}>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor="dailySalary">
          {EMPLOYMENT_FIELDS.dailySalary.label}
        </FieldLabel>
        <AutoExtractedBadge
          extracted={proposals.dailySalary}
          value={field.state.value}
        />
      </div>
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
      <ProposalHint name="dailySalary" field={field} proposals={proposals} />
      <FieldError errors={errors} />
    </Field>
  );
}

const DEPARTMENT_ITEMS = DEPARTMENT_LIST.map((value) => ({
  value,
  label: value,
}));

const COMPANY_ITEMS = COMPANY_LIST.map((value) => ({ value, label: value }));

const SEX_ITEMS = SEX_LIST.map((value) => ({
  value,
  label: SEXES[value].label,
}));

function JobTitleField({ field }: { field: AnyFieldApi }) {
  const { errors } = field.state.meta;

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor="jobTitle">
        {EMPLOYMENT_FIELDS.jobTitle.label}
      </FieldLabel>
      <Combobox
        name="jobTitle"
        items={JOB_TITLE_LIST}
        value={field.state.value || null}
        onValueChange={(value) => field.handleChange(value ?? "")}
      >
        <ComboboxInput
          id="jobTitle"
          placeholder="Busca un puesto"
          aria-invalid={errors.length > 0}
          onBlur={field.handleBlur}
        />
        <ComboboxContent>
          <ComboboxEmpty>No encontramos ese puesto.</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldError errors={errors} />
    </Field>
  );
}

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
  proposals,
}: {
  name: keyof EmploymentInput;
  field: AnyFieldApi;
  type?: "text" | "email" | "date";
  proposals?: ImssProposals;
}) {
  const { errors } = field.state.meta;

  return (
    <Field data-invalid={errors.length > 0}>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={name}>{EMPLOYMENT_FIELDS[name].label}</FieldLabel>
        {proposals && name === "hireDate" ? (
          <AutoExtractedBadge
            extracted={proposals.hireDate}
            value={field.state.value}
          />
        ) : null}
      </div>
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
      {proposals && name === "hireDate" ? (
        <ProposalHint name={name} field={field} proposals={proposals} />
      ) : null}
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
    const previous = proposalsOf(upload);

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

      // HR's own value stays; only an empty field or the last proposal makes room for the new one.
      for (const name of PROPOSAL_NAMES) {
        const proposal = uploaded.extraction.fields[name];
        const typed = form.getFieldValue(name).trim();

        if (proposal && (typed === "" || typed === previous[name])) {
          form.setFieldValue(name, proposal);
        }
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
          {(field) => <JobTitleField field={field} />}
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
        <form.Field name="company">
          {(field) => (
            <SelectField name="company" field={field} items={COMPANY_ITEMS} />
          )}
        </form.Field>
        <form.Field name="nationality">
          {(field) => <TextField name="nationality" field={field} />}
        </form.Field>
        <form.Field name="sex">
          {(field) => (
            <SelectField name="sex" field={field} items={SEX_ITEMS} />
          )}
        </form.Field>
        <ImssRegistrationField upload={upload} onPick={pick} />
        <form.Field name="hireDate">
          {(field) => (
            <TextField
              name="hireDate"
              field={field}
              type="date"
              proposals={proposalsOf(upload)}
            />
          )}
        </form.Field>
        <form.Field name="dailySalary">
          {(field) => (
            <SalaryField field={field} proposals={proposalsOf(upload)} />
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

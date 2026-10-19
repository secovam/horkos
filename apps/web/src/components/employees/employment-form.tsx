import { Button } from "@horkos/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";
import { Checkbox } from "@horkos/ui/components/checkbox";
import {
  Field,
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

import { saveEmployment } from "@/functions/employees";
import {
  COMPANY_LIST,
  DEPARTMENT_LIST,
  EMPLOYMENT_FIELDS,
  OFFICE_LIST,
  SEXES,
  SEX_LIST,
  WORK_EMAIL_DOMAIN,
  employmentSchema,
} from "@/lib/employment";
import type { EmploymentInput } from "@/lib/employment";

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
  onDone,
}: {
  invitationId: string;
  values: EmploymentInput;
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
    onError: (error) => toast.error(error.message),
  });

  const form = useForm({
    defaultValues: values,
    validators: { onSubmit: employmentSchema },
    onSubmitInvalid: () => {
      document
        .querySelector<HTMLElement>('main [aria-invalid="true"]')
        ?.focus();
    },
    onSubmit: ({ value }) => save.mutate(value),
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
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-primary">Datos laborales</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              {(field) => (
                <TextField name="hireDate" field={field} type="date" />
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
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
      </div>
    </form>
  );
}

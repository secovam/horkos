import { Alert, AlertDescription } from "@horkos/ui/components/alert";
import { Button } from "@horkos/ui/components/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@horkos/ui/components/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@horkos/ui/components/select";
import { toast } from "@horkos/ui/components/toast";
import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { FieldProposals } from "@/components/employees/field-proposals";
import { usePostalCode } from "@/components/submission/use-postal-code";
import { findEmployeePostalCode, updateEmployee } from "@/functions/employees";
import type { FieldReview } from "@/lib/employee-record";
import { matchSuburb } from "@/lib/postal-code";
import {
  MARITAL_STATUSES,
  MARITAL_STATUS_LIST,
  RELATIONSHIPS,
  RELATIONSHIP_LIST,
  SUBMISSION_FIELDS,
  SUBMISSION_SECTIONS,
  submissionSchema,
} from "@/lib/submission";
import type { SubmissionInput } from "@/lib/submission";

const SECTIONS = ["personal", "address", "beneficiary"] as const;

function choiceItems<T extends string>(
  values: readonly T[],
  labels: Record<T, { label: string }>
) {
  return values.map((value) => ({ value, label: labels[value].label }));
}

const CHOICES = {
  maritalStatus: choiceItems(MARITAL_STATUS_LIST, MARITAL_STATUSES),
  beneficiaryRelationship: choiceItems(RELATIONSHIP_LIST, RELATIONSHIPS),
} as const;

function isChoice(name: keyof SubmissionInput): name is keyof typeof CHOICES {
  return name === "maritalStatus" || name === "beneficiaryRelationship";
}

// The postal code owns suburb, municipality and state, as in the employee's form.
const CATALOG_FIELDS = new Set<keyof SubmissionInput>([
  "suburb",
  "city",
  "state",
]);

function EditableField({
  review,
  field,
  items,
  locked = false,
  problem,
}: {
  review: FieldReview;
  field: AnyFieldApi;
  items?: readonly { value: string; label: string }[];
  locked?: boolean;
  problem?: string;
}) {
  const errors = locked ? [] : field.state.meta.errors;
  const invalid = problem !== undefined || errors.length > 0;
  const name = review.field;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>{SUBMISSION_FIELDS[name].label}</FieldLabel>
      {items ? (
        <Select
          name={name}
          items={items}
          value={field.state.value || null}
          onValueChange={(value) => field.handleChange(value ?? "")}
        >
          <SelectTrigger
            id={name}
            aria-invalid={invalid}
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
      ) : (
        <Input
          id={name}
          name={name}
          type="text"
          spellCheck={false}
          disabled={locked}
          aria-invalid={invalid}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
        />
      )}
      <div className="text-sm">
        <FieldProposals review={review} />
      </div>
      {problem ? (
        <FieldError>{problem}</FieldError>
      ) : (
        <FieldError errors={errors} />
      )}
    </Field>
  );
}

export function EmployeeEditForm({
  invitationId,
  values,
  fields,
  onDone,
}: {
  invitationId: string;
  values: SubmissionInput;
  fields: readonly FieldReview[];
  onDone: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: SubmissionInput) =>
      updateEmployee({ data: { invitationId, fields: input } }),
    onSuccess: async () => {
      toast.success("Datos guardados");
      await Promise.all([
        router.invalidate(),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
      ]);
      onDone();
    },
  });

  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: values,
    validators: { onSubmit: submissionSchema },
    onSubmitInvalid: () => {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    },
    onSubmit: ({ value }) => save.mutate(value),
  });

  const suburb = useStore(form.store, (state) => state.values.suburb);

  const postal = usePostalCode(
    useStore(form.store, (state) => state.values.postalCode.trim()),
    (postalCode) => findEmployeePostalCode({ data: { postalCode } })
  );

  const { area } = postal;

  // The server replaces state and municipality with the catalog's, so the form shows them first.
  useEffect(() => {
    if (!area) {
      return;
    }

    form.setFieldValue("city", area.municipality);
    form.setFieldValue("state", area.state);

    const listed = matchSuburb(area.suburbs, suburb) ?? "";

    if (listed !== suburb) {
      form.setFieldValue("suburb", listed);
    }
  }, [form, area, suburb]);

  function itemsFor(name: keyof SubmissionInput) {
    if (isChoice(name)) {
      return CHOICES[name];
    }

    return name === "suburb"
      ? area?.suburbs.map((value) => ({ value, label: value }))
      : undefined;
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
        <DialogTitle>Datos del empleado</DialogTitle>
        <DialogDescription>
          Corrige lo que el empleado envió. Debajo de cada campo ves lo que
          leímos de sus documentos.
        </DialogDescription>
      </DialogHeader>
      {SECTIONS.map((section) => (
        <FieldSet key={section}>
          <FieldLegend>{SUBMISSION_SECTIONS[section]}</FieldLegend>
          <FieldGroup>
            {fields.flatMap((review) =>
              SUBMISSION_FIELDS[review.field].section === section
                ? [
                    <form.Field
                      key={review.field}
                      name={review.field}
                      validators={
                        review.field === "postalCode"
                          ? { onSubmit: () => postal.blocker }
                          : undefined
                      }
                    >
                      {(field) => (
                        <EditableField
                          review={review}
                          field={field}
                          items={itemsFor(review.field)}
                          locked={
                            postal.locked &&
                            CATALOG_FIELDS.has(review.field) &&
                            !(review.field === "suburb" && area)
                          }
                          problem={
                            review.field === "postalCode"
                              ? postal.problem
                              : undefined
                          }
                        />
                      )}
                    </form.Field>,
                  ]
                : []
            )}
          </FieldGroup>
        </FieldSet>
      ))}

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

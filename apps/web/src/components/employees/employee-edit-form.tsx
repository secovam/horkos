import { Button } from "@horkos/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { useForm } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { FieldProposals } from "@/components/employees/field-proposals";
import { updateEmployee } from "@/functions/employees";
import type { FieldReview } from "@/lib/employee-record";
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

function EditableField({
  review,
  field,
}: {
  review: FieldReview;
  field: AnyFieldApi;
}) {
  const invalid = field.state.meta.errors.length > 0;
  const name = review.field;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>{SUBMISSION_FIELDS[name].label}</FieldLabel>
      {isChoice(name) ? (
        <Select
          name={name}
          items={CHOICES[name]}
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
            {CHOICES[name].map((item) => (
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
          aria-invalid={invalid}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
        />
      )}
      <div className="text-sm">
        <FieldProposals review={review} />
      </div>
      <FieldError errors={field.state.meta.errors} />
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
    onError: (error) => toast.error(error.message),
  });

  const form = useForm({
    defaultValues: values,
    validators: { onSubmit: submissionSchema },
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
      {SECTIONS.map((section) => (
        <Card key={section}>
          <CardHeader>
            <CardTitle>
              <h2 className="text-primary">{SUBMISSION_SECTIONS[section]}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {fields.flatMap((review) =>
                SUBMISSION_FIELDS[review.field].section === section
                  ? [
                      <form.Field key={review.field} name={review.field}>
                        {(field) => (
                          <EditableField review={review} field={field} />
                        )}
                      </form.Field>,
                    ]
                  : []
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      ))}

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

import { Button } from "@horkos/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@horkos/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@horkos/ui/components/field";
import { Input } from "@horkos/ui/components/input";
import { toast } from "@horkos/ui/components/toast";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { createInvitation } from "@/functions/invitations";
import { newInvitationSchema } from "@/lib/invitation";

const FIELDS = [
  {
    name: "employeeName",
    label: "Nombre del empleado",
    type: "text",
    autoComplete: "off",
  },
  {
    name: "email",
    label: "Correo electrónico",
    type: "email",
    autoComplete: "off",
  },
] as const;

export function NewInvitationDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { employeeName: "", email: "" },
    validators: { onSubmit: newInvitationSchema },
    onSubmit: async ({ value }) => {
      try {
        await createInvitation({ data: value });
        toast.success("Invitación enviada");
        setOpen(false);
        form.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }

      // Also after a failed send: the invitation may already be stored.
      await queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Nueva invitación
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva invitación</DialogTitle>
            <DialogDescription>
              El empleado recibirá un enlace personal para subir sus documentos
              y completar sus datos.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {FIELDS.map(({ name, label, type, autoComplete }) => (
              <form.Field key={name} name={name}>
                {(field) => {
                  const invalid = field.state.meta.errors.length > 0;

                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type={type}
                        autoComplete={autoComplete}
                        aria-invalid={invalid}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  );
                }}
              </form.Field>
            ))}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Enviar invitación"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@horkos/ui/components/alert-dialog";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import {
  deleteRegistration,
  inviteAllRegistrations,
  updateRegistration,
} from "@/functions/registrations";
import { newInvitationSchema } from "@/lib/invitation";

interface Registration {
  id: string;
  employeeName: string;
  email: string;
}

const FIELDS = [
  { name: "employeeName", label: "Nombre del empleado", type: "text" },
  { name: "email", label: "Correo electrónico", type: "email" },
] as const;

export function EditRegistrationDialog({
  registration,
}: {
  registration: Registration;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      employeeName: registration.employeeName,
      email: registration.email,
    },
    validators: { onSubmit: newInvitationSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateRegistration({ data: { id: registration.id, ...value } });
        toast.success("Registro actualizado");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }

      await queryClient.invalidateQueries({ queryKey: ["registrations"] });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        form.reset();
      }}
    >
      <DialogTrigger
        render={<Button variant="ghost-primary" size="icon-sm" />}
        aria-label={`Editar: ${registration.employeeName}`}
        title="Editar"
      >
        <PencilIcon />
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
            <DialogTitle>Editar registro</DialogTitle>
            <DialogDescription>
              Corrige el nombre o el correo antes de enviar la invitación.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {FIELDS.map(({ name, label, type }) => (
              <form.Field key={name} name={name}>
                {(field) => {
                  const invalid = field.state.meta.errors.length > 0;

                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={`${registration.id}-${name}`}>
                        {label}
                      </FieldLabel>
                      <Input
                        id={`${registration.id}-${name}`}
                        name={field.name}
                        type={type}
                        autoComplete="off"
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
                  {isSubmitting ? "Guardando…" : "Guardar"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteRegistrationAction({
  registration,
}: {
  registration: Registration;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteRegistration({ data: { id: registration.id } }),
    onSuccess: () => {
      toast.success("Registro borrado", {
        description: `Se borró el registro de ${registration.employeeName} (${registration.email})`,
      });
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["registrations"] }),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost-destructive" size="icon-sm" />}
        aria-label={`Borrar: ${registration.employeeName}`}
        title="Borrar"
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar el registro?</AlertDialogTitle>
          <AlertDialogDescription>
            No se enviará invitación a este correo. La persona puede volver a
            registrarse.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Borrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function InviteAllButton({ pending }: { pending: number }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => inviteAllRegistrations(),
    onSuccess: ({ invited, skipped }) => {
      toast.success(`${invited} invitaciones en cola`, {
        description:
          skipped > 0
            ? `${skipped} correos ya tenían invitación y se omitieron. Los correos salen en unos minutos.`
            : "Los correos salen en unos minutos.",
      });
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["registrations"] }),
        queryClient.invalidateQueries({ queryKey: ["invitations"] }),
      ]),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button disabled={pending === 0} />}>
        <SendIcon data-icon="inline-start" />
        Invitar a todos
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Invitar a todos los registrados?</AlertDialogTitle>
          <AlertDialogDescription>
            Se enviará una invitación a {pending} registros. Los correos que ya
            tienen invitación se omiten. Los registros salen de esta lista.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Invitar a todos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

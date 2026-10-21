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
import { toast } from "@horkos/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { confirmEmployee, reopenEmployee } from "@/functions/employees";

const ACTIONS = {
  confirm: {
    label: "Confirmar datos",
    title: "¿Confirmar los datos del empleado?",
    description:
      "Los datos confirmados son los que se usarán en el contrato. Podrás corregirlos después mientras no se genere el contrato.",
    success: "Datos confirmados",
    triggerVariant: "default",
    run: confirmEmployee,
  },
  reopen: {
    label: "Corregir datos",
    title: "¿Corregir los datos confirmados?",
    description:
      "El expediente volverá a revisión y no se podrá usar en un contrato hasta que lo confirmes de nuevo.",
    success: "El expediente volvió a revisión",
    triggerVariant: "outline",
    run: reopenEmployee,
  },
} as const;

const ATTENTION_NOTICE =
  "Hay datos que difieren de los documentos o documentos sin leer.";

const EMPLOYMENT_NOTICE =
  "Completa los datos laborales antes de confirmar el expediente.";

export function RecordAction({
  action,
  invitationId,
  needsAttention = false,
  employmentComplete = true,
}: {
  action: keyof typeof ACTIONS;
  invitationId: string;
  needsAttention?: boolean;
  employmentComplete?: boolean;
}) {
  const config = ACTIONS[action];
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const description =
    action === "confirm" && needsAttention
      ? `${ATTENTION_NOTICE} ${config.description}`
      : config.description;

  const blocked = action === "confirm" && !employmentComplete;

  const mutation = useMutation({
    mutationFn: () => config.run({ data: { invitationId } }),
    onSuccess: () => {
      toast.success(config.success);
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      Promise.all([
        router.invalidate(),
        queryClient.invalidateQueries({ queryKey: ["employees"] }),
        queryClient.invalidateQueries({ queryKey: ["invitations"] }),
      ]),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant={config.triggerVariant} />}>
        {config.label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked ? EMPLOYMENT_NOTICE : description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending || blocked}
            onClick={() => mutation.mutate()}
          >
            {config.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

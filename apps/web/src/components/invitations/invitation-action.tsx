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
import { BanIcon, SendIcon } from "lucide-react";
import { useState } from "react";

import { resendInvitation, revokeInvitation } from "@/functions/invitations";

const ACTIONS = {
  resend: {
    icon: SendIcon,
    label: "Reenviar",
    title: "¿Reenviar la invitación?",
    description:
      "Se enviará un enlace nuevo por correo. El enlace anterior dejará de funcionar.",
    variant: "default",
    triggerVariant: "ghost-primary",
    success: "Invitación reenviada",
    successDescription: "Se reenvió la invitación a",
    run: resendInvitation,
  },
  revoke: {
    icon: BanIcon,
    label: "Revocar",
    title: "¿Revocar la invitación?",
    description:
      "El enlace dejará de funcionar. Podrás enviar una invitación nueva a este correo.",
    variant: "destructive",
    triggerVariant: "ghost-destructive",
    success: "Invitación revocada",
    successDescription: "Se revocó la invitación de",
    run: revokeInvitation,
  },
} as const;

export function InvitationAction({
  action,
  invitation,
}: {
  action: keyof typeof ACTIONS;
  invitation: { id: string; employeeName: string; email: string };
}) {
  const config = ACTIONS[action];
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => config.run({ data: { id: invitation.id } }),
    onSuccess: () => {
      toast.success(config.success, {
        description: `${config.successDescription} ${invitation.employeeName} (${invitation.email})`,
      });
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant={config.triggerVariant} size="icon-sm" />}
        aria-label={`${config.label}: ${invitation.employeeName}`}
        title={config.label}
      >
        <config.icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={config.variant}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {config.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

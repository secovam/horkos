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

interface Invitation {
  id: string;
  employeeName: string;
  email: string;
}

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
    successDescription: ({ employeeName, email }: Invitation) =>
      `Se reenvió la invitación a ${employeeName} (${email})`,
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
    successDescription: ({ employeeName, email }: Invitation) =>
      `Se revocó la invitación de ${employeeName} (${email})`,
    run: revokeInvitation,
  },
} as const;

export function InvitationAction({
  action,
  invitation,
}: {
  action: keyof typeof ACTIONS;
  invitation: Invitation;
}) {
  const {
    icon: Icon,
    label,
    title,
    description,
    variant,
    triggerVariant,
    success,
    successDescription,
    run,
  } = ACTIONS[action];

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => run({ data: { id: invitation.id } }),
    onSuccess: () => {
      toast.success(success, {
        description: successDescription(invitation),
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
        render={<Button variant={triggerVariant} size="icon-sm" />}
        aria-label={`${label}: ${invitation.employeeName}`}
        title={label}
      >
        <Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

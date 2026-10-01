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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BanIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { resendInvitation, revokeInvitation } from "@/functions/invitations";

const ACTIONS = {
  resend: {
    icon: SendIcon,
    label: "Reenviar",
    title: "¿Reenviar la invitación?",
    description:
      "Se enviará un enlace nuevo por correo. El enlace anterior dejará de funcionar.",
    variant: "default",
    success: "Invitación reenviada",
    run: resendInvitation,
  },
  revoke: {
    icon: BanIcon,
    label: "Revocar",
    title: "¿Revocar la invitación?",
    description:
      "El enlace dejará de funcionar. Podrás enviar una invitación nueva a este correo.",
    variant: "destructive",
    success: "Invitación revocada",
    run: revokeInvitation,
  },
} as const;

export function InvitationAction({
  action,
  invitation,
}: {
  action: keyof typeof ACTIONS;
  invitation: { id: string; employeeName: string };
}) {
  const {
    icon: Icon,
    label,
    title,
    description,
    variant,
    success,
    run,
  } = ACTIONS[action];

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => run({ data: { id: invitation.id } }),
    onSuccess: () => {
      toast.success(success);
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
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

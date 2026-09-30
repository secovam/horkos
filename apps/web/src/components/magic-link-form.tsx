import { Button } from "@horkos/ui/components/button";
import { Input } from "@horkos/ui/components/input";
import { Label } from "@horkos/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

export default function MagicLinkForm() {
  const [emailSent, setEmailSent] = useState(false);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.magicLink(
        { email: value.email, callbackURL: "/dashboard" },
        {
          onSuccess: () => setEmailSent(true),
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({ email: z.email("Ingresa un correo válido") }),
    },
  });

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Ingresa a Horkos</h1>
      {emailSent && (
        <output className="mb-4 block text-center">
          Si tu cuenta está habilitada, recibirás un enlace de acceso.
        </output>
      )}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Correo electrónico</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-destructive">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Enviando…" : "Enviar enlace"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

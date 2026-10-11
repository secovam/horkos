import { Button } from "@horkos/ui/components/button";
import { Card, CardContent } from "@horkos/ui/components/card";
import { Input } from "@horkos/ui/components/input";
import { Label } from "@horkos/ui/components/label";
import { toast } from "@horkos/ui/components/toast";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

export default function MagicLinkForm() {
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      await authClient.signIn.magicLink(
        { email: value.email.trim().toLowerCase(), callbackURL: "/dashboard" },
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
    <div className="mx-6 flex w-full max-w-md items-center py-10">
      <Card className="w-full">
        <CardContent>
          <div className="flex flex-col gap-6 py-8 sm:py-10">
            <header className="flex flex-col items-center gap-5 text-center">
              <img
                alt="Secovam Capital Humano"
                className="h-auto w-56 max-w-full"
                src="/logo-secovam.png"
              />
              <div className="space-y-2">
                <h1 className="text-foreground text-2xl font-semibold">
                  Acceso para colaboradores
                </h1>
                <p className="text-muted-foreground">
                  Ingresa tu correo electrónico y te enviaremos un enlace para
                  iniciar sesión.
                </p>
              </div>
            </header>
            {emailSent ? (
              <output className="text-center text-sm">
                Hemos enviado un enlace mágico a tu correo electrónico. Abre el
                enlace para iniciar sesión. Puedes cerrar esta página.
              </output>
            ) : (
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
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

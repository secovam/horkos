import { Button } from "@horkos/ui/components/button";
import { Card, CardContent } from "@horkos/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@horkos/ui/components/field";
import { Input } from "@horkos/ui/components/input";
import { toast } from "@horkos/ui/components/toast";
import { useForm } from "@tanstack/react-form";
import { MailCheckIcon } from "lucide-react";
import { useState } from "react";

import { Turnstile } from "@/components/registration/turnstile";
import { register } from "@/functions/registrations";
import { publicRegistrationSchema } from "@/lib/registration";

const FIELDS = [
  {
    name: "employeeName",
    label: "Nombre completo",
    type: "text",
    autoComplete: "name",
  },
  {
    name: "email",
    label: "Correo electrónico",
    type: "email",
    autoComplete: "email",
  },
] as const;

export function RegistrationForm({ siteKey }: { siteKey: string }) {
  const [registered, setRegistered] = useState(false);
  // Bumped after a failed submit: the token was spent, so the widget remounts for a new one.
  const [widgetKey, setWidgetKey] = useState(0);

  const form = useForm({
    defaultValues: { employeeName: "", email: "", turnstileToken: "" },
    validators: { onSubmit: publicRegistrationSchema },
    onSubmit: async ({ value }) => {
      try {
        await register({ data: value });
        setRegistered(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
        form.setFieldValue("turnstileToken", "");
        setWidgetKey((key) => key + 1);
      }
    },
  });

  return (
    <Card>
      <CardContent>
        {registered ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full">
              <MailCheckIcon className="size-6" />
            </div>
            <h1 className="text-primary text-xl font-semibold text-balance">
              Gracias por registrarte
            </h1>
            <p className="text-muted-foreground text-pretty">
              Recursos Humanos te enviará por correo un enlace para subir tus
              documentos cuando comience la campaña de actualización de datos.
              Ya puedes cerrar esta página.
            </p>
          </div>
        ) : (
          <form
            className="flex flex-col gap-6 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
          >
            <header className="flex flex-col items-center gap-5 text-center">
              <img
                alt="Grupo Secovam"
                className="h-auto w-56 max-w-full"
                src="/logo-secovam.png"
              />
              <div className="space-y-2">
                <h1 className="text-primary text-xl font-semibold">
                  Registro de empleados
                </h1>
                <p className="text-muted-foreground text-pretty">
                  Déjanos tu nombre y correo. Recursos Humanos te enviará un
                  enlace para subir tus documentos cuando comience la campaña de
                  actualización de datos.
                </p>
              </div>
            </header>
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
              <form.Field name="turnstileToken">
                {(field) => (
                  <Field data-invalid={field.state.meta.errors.length > 0}>
                    <Turnstile
                      key={widgetKey}
                      siteKey={siteKey}
                      onToken={(token) => field.handleChange(token)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando…" : "Registrarme"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

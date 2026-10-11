import { Card, CardContent } from "@horkos/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="login-background grid h-svh place-items-center">
      <Card className="mx-6 w-full max-w-2xl">
        <CardContent>
          <div className="flex flex-col items-center gap-6 py-8 text-center sm:py-12">
            <img
              alt="Secovam Capital Humano"
              className="h-auto w-64 max-w-full"
              src="/logo-secovam.png"
            />
            <div className="space-y-3">
              <h1 className="text-secondary-foreground text-2xl font-semibold sm:text-3xl">
                Campaña de actualización de datos
              </h1>
              <p className="text-muted-foreground">
                Ayúdanos a mantener al día tu información como colaborador.
              </p>
              <p className="text-muted-foreground">Gracias por participar.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

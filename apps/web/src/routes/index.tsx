import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="grid h-svh place-items-center">
      <h1 className="text-4xl font-semibold">Horkos</h1>
    </main>
  );
}

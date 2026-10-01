import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@horkos/ui/components/breadcrumb";
import { Separator } from "@horkos/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@horkos/ui/components/sidebar";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await getUser();

    if (!session) {
      throw redirect({
        to: "/login",
      });
    }

    return { session };
  },
});

function AuthLayout() {
  const { session } = Route.useRouteContext();

  const title = useMatches({
    select: (matches) => matches.at(-1)?.staticData.title,
  });

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger />
          <div className="flex h-4">
            <Separator orientation="vertical" />
          </div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/dashboard" />}>
                  Inicio
                </BreadcrumbLink>
              </BreadcrumbItem>
              {title ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-6 px-4 pb-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

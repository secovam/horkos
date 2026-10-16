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
import { Fragment } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
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

  const crumbs = useMatches({
    select: (matches) =>
      matches.flatMap(({ pathname, staticData, loaderData }) => {
        const title =
          staticData.title ??
          (loaderData && "crumb" in loaderData ? loaderData.crumb : null);

        return title ? [{ title, pathname }] : [];
      }),
  });

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger />
          <div className="mr-2 flex h-4">
            <Separator orientation="vertical" />
          </div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/dashboard" />}>
                  Inicio
                </BreadcrumbLink>
              </BreadcrumbItem>
              {crumbs.map((crumb, index) => (
                <Fragment key={crumb.pathname}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {index === crumbs.length - 1 ? (
                      <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link to={crumb.pathname} />}>
                        {crumb.title}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
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

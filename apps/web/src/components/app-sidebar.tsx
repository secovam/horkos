import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@horkos/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@horkos/ui/components/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChevronsUpDownIcon,
  HouseIcon,
  LogOutIcon,
  MailIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Inicio", icon: HouseIcon },
  { to: "/invitaciones", label: "Invitaciones", icon: MailIcon },
] as const;

export function AppSidebar({
  user,
}: {
  user: { name: string; email: string };
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" onClick={closeMobile} />}
            >
              <img
                src="/logo-secovam.png"
                alt="Grupo Secovam"
                className="h-9 w-auto"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  isActive={pathname.startsWith(item.to)}
                  render={<Link to={item.to} onClick={closeMobile} />}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" />}
                aria-label="Menú de usuario"
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => navigate({ to: "/login" }),
                        },
                      })
                    }
                  >
                    <LogOutIcon />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

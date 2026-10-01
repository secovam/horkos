import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-sidebar-border bg-sidebar/30 rounded-xl border px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-[52px] shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-5" />
          </span>
          <div>
            <h1 className="text-primary text-xl font-bold">{title}</h1>
            <p className="text-sidebar-primary mt-1 text-sm">{description}</p>
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

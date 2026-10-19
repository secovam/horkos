import { Button } from "@horkos/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

function pageRange(page: number, total: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  if (offset >= total) {
    return { first: 0, last: 0 };
  }

  return { first: offset + 1, last: Math.min(offset + pageSize, total) };
}

export function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const { first, last } = pageRange(page, total, pageSize);

  return (
    <nav
      aria-label="Paginación"
      className="text-muted-foreground flex items-center justify-between gap-4 text-sm"
    >
      <p>
        Mostrando{" "}
        <span className="text-foreground font-medium">
          {first}–{last}
        </span>{" "}
        de <span className="text-foreground font-medium">{total}</span>
      </p>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Button>
        <Button
          variant="ghost"
          disabled={first === 0 || last >= total}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}

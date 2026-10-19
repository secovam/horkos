import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";

import {
  EMPLOYMENT_FIELDS,
  SEXES,
  SEX_LIST,
  EMPLOYMENT_FIELD_NAMES,
  formatHireDate,
  formatSalary,
} from "@/lib/employment";
import type { EmploymentInput } from "@/lib/employment";

function isSex(value: string): value is (typeof SEX_LIST)[number] {
  return SEX_LIST.some((sex) => sex === value);
}

function displayEmployment(
  name: keyof EmploymentInput,
  values: EmploymentInput
) {
  const value = values[name];

  if (name === "sex" && isSex(value)) {
    return SEXES[value].label;
  }

  if (name === "hireDate") {
    return formatHireDate(value);
  }

  if (name === "dailySalary") {
    return formatSalary(value);
  }

  return value || "—";
}

const NAMES = EMPLOYMENT_FIELD_NAMES;

export function EmploymentSection({
  values,
  complete,
}: {
  values: EmploymentInput;
  complete: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-primary">Datos laborales</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {complete ? (
          <dl className="divide-y">
            {NAMES.map((name) => (
              <div
                key={name}
                className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4"
              >
                <dt className="text-sidebar-primary text-sm font-medium">
                  {EMPLOYMENT_FIELDS[name].label}
                </dt>
                <dd className="sm:col-span-2">
                  {displayEmployment(name, values)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground">
            RH aún no completa los datos laborales
          </p>
        )}
      </CardContent>
    </Card>
  );
}

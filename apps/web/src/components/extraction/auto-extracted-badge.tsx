import { Badge } from "@horkos/ui/components/badge";
import { BotIcon } from "lucide-react";

// Only while the value is still what the document said, so a correction drops the badge. Hidden rather than unmounted: mounting inside a fieldset leaves Chromium with a stale, collapsed layout.
export function AutoExtractedBadge({
  extracted,
  value,
}: {
  extracted: string | undefined;
  value: string;
}) {
  return (
    <span hidden={extracted === undefined || value !== extracted}>
      <Badge variant="info">
        <BotIcon data-icon="inline-start" />
        Auto-extraído
      </Badge>
    </span>
  );
}

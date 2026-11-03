import { Loader2 } from "lucide-react";

/** Small inline spinner shown beside a filter label while its options load. */
export function FieldSpinner({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <Loader2
      role="status"
      aria-label="Loading options"
      className="h-3 w-3 shrink-0 animate-spin text-primary"
    />
  );
}

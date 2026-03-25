import { Spinner } from "@heroui/react";

/** Small spinner for Button startContent / icon-only loading (HeroUI v3 has no Button isLoading). */
export function ButtonSpinner() {
  return <Spinner color="current" size="sm" className="shrink-0" />;
}

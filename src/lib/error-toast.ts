"use client";

import { toast } from "sonner";

export function errorToast(title: string, description?: string) {
  toast.error(title, description ? { description } : undefined);
}

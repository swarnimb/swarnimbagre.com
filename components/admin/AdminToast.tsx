"use client";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

export function AdminToaster() {
  return <SonnerToaster position="bottom-right" closeButton richColors />;
}

export { toast } from "sonner";

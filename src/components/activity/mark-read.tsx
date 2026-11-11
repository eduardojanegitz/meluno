"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/server/actions/profile";

/** Marca as notificações como lidas depois que a lista ficou visível por um instante. */
export function MarkNotificationsRead() {
  useEffect(() => {
    const t = setTimeout(() => void markNotificationsReadAction({}), 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}

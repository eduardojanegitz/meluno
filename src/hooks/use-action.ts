"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/errors";

/**
 * Executa uma Server Action com estado de envio e feedback de erro padronizado.
 * Erros de validação por campo ficam disponíveis em `fieldErrors`.
 */
export function useAction<I, T>(action: (input: I) => Promise<ActionResult<T>>) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    (input: I, options: { onSuccess?: (data: T) => void; successMessage?: string; silentError?: boolean } = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, code: "INTERNAL", message: "Sem conexão com o servidor. Tente novamente." };
          }
          if (result.ok) {
            setFieldErrors({});
            if (options.successMessage) toast.success(options.successMessage);
            options.onSuccess?.(result.data);
          } else {
            setFieldErrors(result.fieldErrors ?? {});
            if (!options.silentError) toast.error(result.message);
          }
          resolve(result);
        });
      }),
    [action],
  );

  return { run, pending, fieldErrors };
}

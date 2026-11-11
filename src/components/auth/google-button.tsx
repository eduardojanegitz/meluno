"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleIcon } from "./auth-ui";

export function GoogleButton({ label, callbackURL }: { label: string; callbackURL: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full text-[15px]"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({ provider: "google", callbackURL });
        if (error) {
          setPending(false);
          toast.error(authErrorMessage(error));
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
      {label}
    </Button>
  );
}

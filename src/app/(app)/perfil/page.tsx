import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MailOpen } from "lucide-react";
import { PageBody, PageHeader, SectionTitle } from "@/components/app/page-header";
import { MemberAvatar } from "@/components/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PixKeys, ProfileForm } from "@/components/profile/profile-forms";
import { ThemeChoice } from "@/components/profile/theme-choice";
import { DeleteAccount } from "@/components/profile/delete-account";
import { requireViewer } from "@/server/auth/session";
import { getProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Perfil" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader brand title="Perfil" />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <ProfileContent />
        </Suspense>
      </PageBody>
    </>
  );
}

async function ProfileContent() {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer);
  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-center gap-4">
        <MemberAvatar name={profile.name} colorKey={viewer.userId} imageUrl={profile.image} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{profile.name}</p>
          <p className="text-muted-foreground truncate text-sm">{profile.email}</p>
        </div>
      </div>

      <Link href="/convites" className="bg-card hover:bg-muted/50 flex items-center gap-3 rounded-2xl border shadow-card px-4 py-3.5 text-sm font-medium">
        <MailOpen className="text-muted-foreground size-5" aria-hidden="true" />
        <span className="flex-1">Convites recebidos</span>
        <ChevronRight className="text-muted-foreground size-4" aria-hidden="true" />
      </Link>

      <ProfileForm profile={profile} />
      <PixKeys keys={profile.pixKeys} />

      <section>
        <SectionTitle>Aparência</SectionTitle>
        <ThemeChoice />
      </section>

      <section className="space-y-3">
        <SectionTitle>Conta</SectionTitle>
        {profile.hasPassword ? (
          <Link href="/recuperar-senha" className="text-muted-foreground hover:text-foreground block text-sm underline-offset-4 hover:underline">
            Alterar senha
          </Link>
        ) : null}
        <SignOutButton />
      </section>

      <section className="space-y-2">
        <SectionTitle>Privacidade</SectionTitle>
        <p className="text-muted-foreground text-sm">Você pode excluir sua conta e seus dados pessoais a qualquer momento.</p>
        <DeleteAccount hasPassword={profile.hasPassword} />
      </section>
    </div>
  );
}

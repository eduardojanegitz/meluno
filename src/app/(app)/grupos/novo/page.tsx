import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { CreateGroupForm } from "@/components/group/create-group-form";

export const metadata: Metadata = { title: "Novo grupo" };

export default function NewGroupPage() {
  return (
    <>
      <PageHeader backHref="/grupos" title="Novo grupo" subtitle="Dê um nome e diga com quem você divide. Dá para convidar depois." />
      <PageBody>
        <CreateGroupForm />
      </PageBody>
    </>
  );
}

import type { Metadata } from "next";

import { SosContactForm } from "@/components/admin/content/sos-contact-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { listChildOptions, listSosContacts } from "@/lib/services/sos-contacts";

export const metadata: Metadata = { title: "Add SOS contact" };

export default async function NewSosContactPage() {
  const [children, contacts] = await Promise.all([listChildOptions(), listSosContacts()]);
  return (
    <PageContainer>
      <PageHeader
        title="Add SOS contact"
        breadcrumbs={[{ label: "What families see" }, { label: "SOS contacts", href: "/admin/content/sos" }, { label: "Add" }]}
      />
      <SosContactForm childOptions={children} existingTags={[...new Set(contacts.map((c) => c.label))]} />
    </PageContainer>
  );
}

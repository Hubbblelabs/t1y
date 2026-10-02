import type { Metadata } from "next";

import { SosContactForm } from "@/components/admin/content/sos-contact-form";
import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { getSosContact, listChildOptions, listSosContacts } from "@/lib/services/sos-contacts";

export const metadata: Metadata = { title: "Edit SOS contact" };

export default async function EditSosContactPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [contact, children, contacts] = await Promise.all([
    getSosContact(id),
    listChildOptions(),
    listSosContacts(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={contact.name}
        breadcrumbs={[{ label: "What families see" }, { label: "SOS contacts", href: "/admin/content/sos" }, { label: contact.name }]}
      />
      <SosContactForm
        contactId={id}
        initial={{
          name: contact.name,
          phone: contact.phone,
          label: contact.label,
          visibleToAll: contact.visibleToAll,
          active: contact.active,
          participantIds: contact.participantIds,
        }}
        childOptions={children}
        existingTags={[...new Set(contacts.map((c) => c.label))]}
      />
    </PageContainer>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall, Plus } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { listSosContacts } from "@/lib/services/sos-contacts";

export const metadata: Metadata = { title: "SOS contacts" };

/** Emergency contacts families can call from the app, and who sees each. */
export default async function SosContactsPage() {
  const contacts = await listSosContacts();

  return (
    <PageContainer>
      <PageHeader
        title="SOS contacts"
        description="Doctors, nurses and anyone else a family can call from the app in an emergency"
        breadcrumbs={[{ label: "What families see" }, { label: "SOS contacts" }]}
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/content/sos/new">
              <Plus className="size-4" aria-hidden="true" />
              Add contact
            </Link>
          </Button>
        }
      />

      <Card>
        {contacts.length === 0 ? (
          <EmptyState
            icon={PhoneCall}
            title="No SOS contacts yet"
            description="Add a contact and choose which children see it."
          />
        ) : (
          <ul className="divide-line divide-y">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/admin/content/sos/${contact.id}`} className="hover:bg-surface-hover flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate font-medium">{contact.name}</p>
                    <p className="text-ink-subtle truncate text-xs">{contact.phone}</p>
                  </div>
                  <Badge tone="info">{contact.label}</Badge>
                  <span className="text-ink-muted text-xs">
                    {contact.visibleToAll
                      ? "Every child"
                      : `${contact.childCount} ${contact.childCount === 1 ? "child" : "children"}`}
                  </span>
                  {!contact.active ? <Badge tone="neutral">Hidden</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageContainer>
  );
}

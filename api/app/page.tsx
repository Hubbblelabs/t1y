import { redirect } from "next/navigation";

/**
 * The deployment serves two things: the admin dashboard and the mobile API.
 * There is no public marketing surface, so the root sends visitors to the
 * dashboard, which then decides between the login page and the app.
 */
export default function RootPage() {
  redirect("/admin/dashboard");
}

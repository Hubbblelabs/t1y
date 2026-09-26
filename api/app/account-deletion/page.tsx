import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete your account — T1D Prajana Yandra",
  robots: { index: true, follow: false },
};

/**
 * The account deletion page Google Play requires for any app that lets
 * people create an account: how to delete from inside the app, how to ask
 * without the app, and what is removed and kept.
 */
export default function AccountDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed text-gray-900">
      <h1 className="mb-1 text-2xl font-bold">Delete your T1D Prajana Yandra account</h1>
      <p className="mb-8 text-gray-700">T1D Prajana Yandra</p>

      <h2 className="mb-2 text-lg font-semibold">In the app</h2>
      <ol className="mb-6 list-decimal pl-6">
        <li>Open the app and tap the profile button at the top right.</li>
        <li>Tap the gear to open Settings.</li>
        <li>Tap “Correct or delete your data”, then “Delete my account”.</li>
        <li>Enter your account password to confirm.</li>
      </ol>

      <h2 className="mb-2 text-lg font-semibold">Without the app</h2>
      <p className="mb-6">
        Ask your study coordinator at the Maadhuram Diabetic Center, Coimbatore, giving your
        child&apos;s ID or the email address on the account. The study team deletes the account
        within 30 days of the request.
      </p>

      <h2 className="mb-2 text-lg font-semibold">What is deleted</h2>
      <p className="mb-6">
        The child&apos;s name, date of birth, phone numbers, city, doctor, emergency contact,
        answers to extra questions, help-and-support messages, registered devices, and the
        ability to sign in. This happens immediately when deleting in the app.
      </p>

      <h2 className="mb-2 text-lg font-semibold">What is kept</h2>
      <p className="mb-6">
        Glucose readings, insulin doses, carbohydrate records and quiz results are kept without
        a name, linked only to a study code, as de-identified research data for the study, as
        described in the privacy policy and agreed in the terms.
      </p>

      <p className="text-sm text-gray-700">
        <a className="underline" href="/privacy">
          Privacy policy
        </a>
      </p>
    </main>
  );
}

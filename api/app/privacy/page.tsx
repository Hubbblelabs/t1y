import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy — T1D Prajana Yandra",
  robots: { index: true, follow: false },
};

/**
 * The public privacy policy for the T1D Prajana Yandra app — the URL given to
 * Google Play. Says the same as the app's own "How your data is used" page
 * (app/lib/models/privacy_content.dart) and its Terms (terms_content.dart);
 * keep all three, and docs/COMPLIANCE.md, in step.
 */
const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Who we are",
    body: [
      "T1D Prajana Yandra is an educational app for families of children aged 6 to 15 with Type 1 diabetes, used in a nursing research study at the Maadhuram Diabetic Center, Coimbatore. The study team runs the app and is responsible for the information in it.",
    ],
  },
  {
    title: "What we collect",
    body: [
      "About the parent or guardian: email address, password (stored only as a secure hash), phone number if given, and preferred language.",
      "About the child: name, date of birth, sex, year of diagnosis, treatment, height and weight, city, doctor, emergency contact, and answers to any extra questions the study asks.",
      "Health records the family chooses to enter: glucose readings, insulin doses and carbohydrates eaten, each with the time.",
      "Learning activity: Help Book topics opened, quiz answers and scores, badges earned.",
      "Messages sent to the study team through Help and support.",
      "The parent PIN, stored only as a secure hash.",
    ],
  },
  {
    title: "What we do not collect",
    body: [
      "We do not collect location, contacts, photos, camera, microphone or advertising identifiers. The app shows no advertisements and uses no third-party analytics or advertising services.",
    ],
  },
  {
    title: "Why we use it",
    body: [
      "To provide the app's features to the family, and for the research study, in which the study team looks at how families use the app and how children are doing. Research results are published only in a form that does not identify any child or family. Information is never sold.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "The family, on their phone (health records are behind the parent PIN), and the authorised study team through the study dashboard, where every opening of a child's records is logged. Information is not shared with anyone else unless the law requires it.",
    ],
  },
  {
    title: "Security",
    body: [
      "All information travels over an encrypted (HTTPS) connection and is stored on secured servers. Passwords and PINs are never stored in readable form, and staff access is recorded.",
    ],
  },
  {
    title: "Keeping and deleting information",
    body: [
      "Information is kept while the child takes part in the study and as the study's ethics approval requires.",
      "A family can delete their account at any time in the app (Profile → Settings → Correct or delete your data), or by asking the study team — see the account deletion page. Deleting removes the child's name, date of birth, contact details, answers to extra questions and help messages immediately, and ends sign-in. Glucose readings, insulin doses, carbohydrate records and quiz results are kept without a name, as de-identified research data.",
    ],
  },
  {
    title: "Children",
    body: [
      "The account is created and used by a parent or legal guardian, who agrees to the terms on the child's behalf.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Contact the study coordinator at the Maadhuram Diabetic Center, Coimbatore, or write to the study team in the app under Help and support.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed text-gray-900">
      <h1 className="mb-1 text-2xl font-bold">Privacy policy</h1>
      <p className="mb-8 text-gray-700">T1D Prajana Yandra</p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mb-2">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <p className="mt-10 text-sm text-gray-700">
        <a className="underline" href="/account-deletion">
          How to delete your account
        </a>
      </p>
    </main>
  );
}

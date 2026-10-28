import Link from 'next/link';

export const metadata = {
  title: 'Privacy Notice',
  description: 'How the JAM campus letter platform handles student and faculty data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-transparent py-10 px-4 sm:px-6">
      <article className="max-w-3xl mx-auto paper-card rounded-2xl p-6 sm:p-10 space-y-6 text-sm text-zinc-700 leading-relaxed">
        <div>
          <h1 className="text-2xl font-serif font-black text-black">Privacy Notice</h1>
          <p className="text-xs font-mono text-zinc-500 mt-1">Last updated: 28 October 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="font-bold text-black">What we collect</h2>
          <p>
            JAM stores the account details provisioned by your department (name, roll number or
            faculty email, department, designation), letter requests, approval decisions, digital
            signature images, and signed PDFs. Authentication is handled by Supabase.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-black">Why we use it</h2>
          <p>
            The data is used only to route a letter through the configured mentor/HOD approval
            chain, generate a signed PDF, send transactional notifications, and let a verifier
            confirm that a document was issued by the platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-black">Who can see it</h2>
          <p>
            Students can see their own letters. Faculty can see letters assigned to them or their
            department. Approved letters can be verified publicly by their verification link, which
            exposes only the metadata needed to validate the document, not the full letter body.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-black">Retention and deletion</h2>
          <p>
            Letter records and signed PDFs are retained for the period required by the institution.
            You can request deletion of your account and associated documents from the{' '}
            <Link href="/delete-account" className="underline font-semibold text-black">
              account deletion page
            </Link>
            . Your department HOD processes the request. Audit records may be retained after
            account deletion for accountability.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold text-black">Contact</h2>
          <p>
            For access, correction, or deletion requests, contact your department office or the
            platform administrator at{' '}
            <a className="underline font-semibold text-black" href="mailto:admin@aits-tpt.edu.in">
              admin@aits-tpt.edu.in
            </a>
            .
          </p>
        </section>

        <Link href="/" className="inline-flex text-xs font-bold text-black underline">
          Return to JAM
        </Link>
      </article>
    </main>
  );
}

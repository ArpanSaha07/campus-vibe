import type { Metadata } from "next";
import Link from "next/link";
import { BulletList, ContactCard, LegalPage, Section, sectionId } from "@/app/components/legal/LegalSections";

// Static content, no data fetching, so this route prerenders at build time
// without needing a backend. Bump LAST_UPDATED when the wording changes.

export const metadata: Metadata = {
  title: "Terms of service · CampusVibe",
  description: "The terms that govern your use of the CampusVibe website and related services.",
};

const LAST_UPDATED = "September 15, 2026";
const CONTACT_EMAIL = "sahaarpan550@gmail.com";

const SECTION_TITLES = [
  "About CampusVibe",
  "Eligibility and accounts",
  "User responsibilities",
  "Club and event content",
  "Acceptable use",
  "Content ownership and license",
  "Third-party services and links",
  "Availability and changes to the service",
  "Account suspension or termination",
  "Disclaimers",
  "Limitation of liability",
  "Privacy",
  "Changes to these terms",
  "Governing law",
  "Contact",
];

const title = (number: number) => SECTION_TITLES[number - 1];

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of service" lastUpdated={LAST_UPDATED}>
      <div className="mt-6 space-y-4 text-ink-600 leading-relaxed">
        <p>
          Welcome to CampusVibe. These Terms of Service (“Terms”) govern your use of the CampusVibe website and
          related services.
        </p>
        <p>
          By creating an account or using CampusVibe, you agree to these Terms. If you do not agree, please do not
          use the platform.
        </p>
      </div>

      <nav aria-labelledby="terms-contents" className="mt-8 rounded-2xl bg-mist-100 p-5 sm:p-6">
        <h2 id="terms-contents" className="ticket-label text-ink-600">
          Contents
        </h2>
        <ol className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {SECTION_TITLES.map((sectionTitle, index) => (
            <li key={sectionTitle}>
              <a
                href={`#${sectionId(index + 1)}`}
                className="flex items-baseline gap-2 text-sm text-ink-900 hover:text-lavender-600 transition-colors"
              >
                <span className="font-mono text-xs text-lavender-600">{String(index + 1).padStart(2, "0")}</span>
                {sectionTitle}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10">
        <Section number={1} title={title(1)}>
          <p>
            CampusVibe is a platform designed to help university students discover campus events, clubs,
            activities, and other relevant opportunities.
          </p>
          <p>
            CampusVibe may also provide personalized recommendations based on information users provide and their
            activity on the platform.
          </p>
        </Section>

        <Section number={2} title={title(2)}>
          <p>You must provide accurate information when creating and using an account.</p>
          <p>
            You are responsible for keeping your login credentials secure and for activity that occurs through your
            account.
          </p>
          <p>
            CampusVibe may allow users to sign in using email and password or supported third-party authentication
            services, such as Google OAuth.
          </p>
          <p>
            You must not create an account using another person’s identity or access another user’s account
            without permission.
          </p>
        </Section>

        <Section number={3} title={title(3)}>
          <p>When using CampusVibe, you agree to:</p>
          <BulletList
            items={[
              "provide accurate information where reasonably required;",
              "use the platform only for lawful purposes;",
              "respect other users, clubs, organizations, and university community members;",
              "keep your account information and login credentials secure; and",
              "notify CampusVibe if you believe your account has been accessed without authorization.",
            ]}
          />
          <p>You are responsible for the content and information you submit to the platform.</p>
        </Section>

        <Section number={4} title={title(4)}>
          <p>
            CampusVibe may allow authorized club representatives or administrators to create, update, or manage
            club pages and event listings.
          </p>
          <p>
            Club administrators are responsible for ensuring that information they publish is accurate, current,
            and authorized by the relevant organization.
          </p>
          <p>
            CampusVibe does not guarantee that event details, schedules, locations, prices, availability, or other
            information submitted by users or clubs will always be accurate or up to date.
          </p>
          <p>
            Users should confirm important event information with the relevant club, organizer, or official source
            when necessary.
          </p>
        </Section>

        <Section number={5} title={title(5)}>
          <p>You may not use CampusVibe to:</p>
          <BulletList
            items={[
              "violate any applicable law or regulation;",
              "harass, threaten, impersonate, or harm others;",
              "post fraudulent, misleading, defamatory, hateful, or unlawful content;",
              "upload malicious code, viruses, or other harmful software;",
              "attempt to gain unauthorized access to accounts, systems, or data;",
              "interfere with the normal operation or security of the platform;",
              "scrape, copy, or collect platform data in an abusive or unauthorized way;",
              "send spam or unauthorized promotional content; or",
              "use the platform in a way that could reasonably harm CampusVibe, its users, or participating organizations.",
            ]}
          />
          <p>CampusVibe may remove content or restrict access when these Terms are violated.</p>
        </Section>

        <Section number={6} title={title(6)}>
          <p>
            You retain ownership of content that you submit to CampusVibe, including profile information, club
            information, event descriptions, and images that you are authorized to upload.
          </p>
          <p>
            By submitting content, you grant CampusVibe a non-exclusive, worldwide, royalty-free license to host,
            store, display, reproduce, and process that content only as reasonably necessary to operate, improve,
            and provide the platform.
          </p>
          <p>
            You are responsible for ensuring that you have the necessary rights or permissions to upload any content
            you submit.
          </p>
        </Section>

        <Section number={7} title={title(7)}>
          <p>
            CampusVibe may integrate with or link to third-party services, websites, authentication providers,
            maps, calendars, or other external platforms.
          </p>
          <p>
            CampusVibe is not responsible for the content, availability, security, or practices of third-party
            services.
          </p>
          <p>Your use of third-party services may also be subject to their own terms and privacy policies.</p>
        </Section>

        <Section number={8} title={title(8)}>
          <p>CampusVibe may add, change, suspend, or remove features at any time.</p>
          <p>
            We aim to keep the platform available and reliable, but we do not guarantee uninterrupted or error-free
            access.
          </p>
          <p>
            The platform may occasionally be unavailable because of maintenance, technical issues, security
            concerns, or circumstances outside our control.
          </p>
        </Section>

        <Section number={9} title={title(9)}>
          <p>CampusVibe may suspend, restrict, or terminate an account if we reasonably believe that:</p>
          <BulletList
            items={[
              "these Terms have been violated;",
              "the account is being used fraudulently or unlawfully;",
              "the account creates a security or safety risk; or",
              "suspension or termination is necessary to protect the platform or its users.",
            ]}
          />
          <p>Users may stop using CampusVibe at any time.</p>
        </Section>

        <Section number={10} title={title(10)}>
          <p>CampusVibe is provided on an “as is” and “as available” basis.</p>
          <p>We do not guarantee that:</p>
          <BulletList
            items={[
              "every event or club will be listed;",
              "event information will always be complete or accurate;",
              "recommendations will always match a user’s interests;",
              "events will occur as advertised; or",
              "the platform will always be available without interruptions or errors.",
            ]}
          />
          <p>CampusVibe does not organize or operate third-party club events unless explicitly stated otherwise.</p>
          <p>Participation in events is at the user’s own discretion and risk.</p>
        </Section>

        <Section number={11} title={title(11)}>
          <p>
            To the maximum extent permitted by applicable law, CampusVibe and its operators will not be liable for
            indirect, incidental, special, consequential, or similar damages arising from the use of, or inability
            to use, the platform.
          </p>
          <p>CampusVibe is not responsible for losses or harm resulting from:</p>
          <BulletList
            items={[
              "inaccurate event or club information submitted by third parties;",
              "event cancellations, changes, or disputes;",
              "interactions between users;",
              "third-party websites or services; or",
              "unauthorized access caused by a user’s failure to protect their account credentials.",
            ]}
          />
          <p>Nothing in these Terms excludes liability that cannot legally be excluded.</p>
        </Section>

        <Section number={12} title={title(12)}>
          <p>
            Your use of CampusVibe is also subject to the{" "}
            <Link
              href="/privacy-policy"
              className="text-lavender-600 hover:text-lavender-800 underline underline-offset-4"
            >
              CampusVibe Privacy Policy
            </Link>
            .
          </p>
          <p>The Privacy Policy explains what information is collected, how it is used, and how it is protected.</p>
        </Section>

        <Section number={13} title={title(13)}>
          <p>CampusVibe may update these Terms from time to time.</p>
          <p>
            When significant changes are made, we may provide notice through the platform or by another reasonable
            method.
          </p>
          <p>Continued use of CampusVibe after updated Terms take effect means you accept the revised Terms.</p>
        </Section>

        <Section number={14} title={title(14)}>
          <p>
            These Terms are governed by the applicable laws of the Province of Quebec and the federal laws of Canada
            that apply in Quebec, unless applicable law requires otherwise.
          </p>
          <p>
            Any disputes relating to these Terms or the use of CampusVibe will be handled by courts with appropriate
            jurisdiction, subject to any rights users may have under applicable consumer protection laws.
          </p>
        </Section>

        <Section number={15} title={title(15)}>
          <p>If you have questions about these Terms, you can contact CampusVibe at:</p>
          <ContactCard email={CONTACT_EMAIL} />
        </Section>
      </div>
    </LegalPage>
  );
}

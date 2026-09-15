import type { Metadata } from "next";
import {
  BulletList,
  ContactCard,
  LegalPage,
  Section,
  Subsection,
  TableOfContents,
} from "@/app/components/legal/LegalSections";

// Static content, no data fetching, so this route prerenders at build time
// without needing a backend. Bump LAST_UPDATED when the wording changes.

export const metadata: Metadata = {
  title: "Privacy policy · CampusVibe",
  description: "What CampusVibe collects, how it is used, and how your information is protected.",
};

const LAST_UPDATED = "September 15, 2026";
const CONTACT_EMAIL = "sahaarpan550@gmail.com";

const SECTION_TITLES = [
  "Information we collect",
  "How we use your information",
  "Sharing of information",
  "Personalized recommendations",
  "Data security",
  "Your choices",
  "Children's privacy",
  "External services",
  "Changes to this privacy policy",
  "Contact us",
];

const title = (number: number) => SECTION_TITLES[number - 1];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy policy" lastUpdated={LAST_UPDATED}>
      <p className="mt-6 text-ink-600 leading-relaxed">
        CampusVibe (“CampusVibe,” “we,” “us,” or “our”) respects your privacy. This Privacy Policy explains what
        information we collect, how we use it, and how we protect your information when you use the CampusVibe
        website and services.
      </p>

      <TableOfContents titles={SECTION_TITLES} />

      <div className="mt-10">
        <Section number={1} title={title(1)}>
          <p>CampusVibe currently collects only the information necessary to provide and improve the platform.</p>

          <Subsection title="Account information">
            <p>When you create an account, you may sign in using:</p>
            <BulletList items={["Google OAuth; or", "An email address and password."]} />
            <p>
              When you sign in using Google, CampusVibe may receive basic account information necessary to
              authenticate your account, such as your name, email address, and profile picture, depending on the
              permissions provided by Google.
            </p>
            <p>
              When you create an account using email and password, we collect the information necessary to create
              and authenticate your account.
            </p>
            <p>
              We do not use your authentication information for purposes unrelated to operating your CampusVibe
              account.
            </p>
          </Subsection>

          <Subsection title="Profile information">
            <p>
              You may choose to provide information through your CampusVibe profile. This may include information
              such as:
            </p>
            <BulletList
              items={[
                "Your name or display name;",
                "Profile picture;",
                "University-related information;",
                "Interests;",
                "Clubs you follow;",
                "Events you bookmark or interact with; and",
                "Other profile information that you voluntarily provide.",
              ]}
            />
            <p>You control the information you choose to add to your profile.</p>
          </Subsection>

          <Subsection title="Activity on CampusVibe">
            <p>
              We may collect information about how you interact with CampusVibe, including activities such as:
            </p>
            <BulletList
              items={[
                "Events you view;",
                "Events you search for;",
                "Search terms and filters you use;",
                "Events you bookmark;",
                "Clubs you follow;",
                "Categories or interests you interact with; and",
                "Other activity within the CampusVibe platform.",
              ]}
            />
            <p>
              This information may be used to operate the platform and provide features such as personalized event
              discovery and recommendations.
            </p>
          </Subsection>
        </Section>

        <Section number={2} title={title(2)}>
          <p>We use the information collected through CampusVibe to:</p>
          <BulletList
            items={[
              "Create and manage your account;",
              "Authenticate users;",
              "Provide CampusVibe's features and services;",
              "Personalize event recommendations and search results;",
              "Remember your interests, followed clubs, bookmarks, and preferences;",
              "Improve the functionality and user experience of the platform;",
              "Maintain the security and reliability of CampusVibe; and",
              "Understand how users interact with the platform so we can improve it.",
            ]}
          />
          <p>We do not use your personal information for unrelated purposes without informing you.</p>
        </Section>

        <Section number={3} title={title(3)}>
          <p className="rounded-2xl border border-lavender-200 bg-lavender-50 p-5">
            CampusVibe does{" "}
            <strong className="font-semibold text-lavender-800">
              not sell, rent, or share your personal information with advertisers or other third parties for
              marketing purposes
            </strong>
            .
          </p>
          <p>
            We currently do not provide user profile information or CampusVibe activity information to external
            organizations.
          </p>
          <p>
            Some technical services may necessarily process limited information to provide functionality you
            request. For example, Google processes information when you choose to use Google OAuth for
            authentication. Your use of those services may also be subject to their own privacy policies.
          </p>
        </Section>

        <Section number={4} title={title(4)}>
          <p>
            CampusVibe may use information you provide, along with your activity on the platform, to personalize
            your experience.
          </p>
          <p>
            For example, your interests, followed clubs, searches, event views, and bookmarks may be used to help
            CampusVibe recommend events that are more relevant to you.
          </p>
          <p>
            This information is used within CampusVibe to improve your experience and is not sold to advertisers.
          </p>
        </Section>

        <Section number={5} title={title(5)}>
          <p>
            We take reasonable measures to protect user information from unauthorized access, misuse, alteration, or
            disclosure.
          </p>
          <p>However, no internet-based service can guarantee absolute security.</p>
        </Section>

        <Section number={6} title={title(6)}>
          <p>You may choose what information you add to your CampusVibe profile.</p>
          <p>Where supported by the platform, you may also update or remove information associated with your account.</p>
          <p>
            If you would like to request access to, correction of, or deletion of your personal information, you may
            contact us using the contact information provided below.
          </p>
        </Section>

        <Section number={7} title={title(7)}>
          <p>
            CampusVibe is intended primarily for university and college communities and is not designed for children
            under the age of 13.
          </p>
          <p>We do not knowingly collect personal information from children under 13.</p>
        </Section>

        <Section number={8} title={title(8)}>
          <p>
            CampusVibe may use external services where necessary to operate certain features, such as Google OAuth
            for account authentication.
          </p>
          <p>
            Those services operate under their own terms and privacy policies. CampusVibe does not control how those
            external services process information outside of the CampusVibe platform.
          </p>
        </Section>

        <Section number={9} title={title(9)}>
          <p>
            CampusVibe may update this Privacy Policy as the platform develops, including when new features or
            services are introduced.
          </p>
          <p>
            When we make changes, we will update the <strong className="font-semibold">“Last updated”</strong> date
            at the top of this page.
          </p>
          <p>We encourage users to review this Privacy Policy periodically.</p>
        </Section>

        <Section number={10} title={title(10)}>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or your personal information,
            you can reach out to us through email:
          </p>
          <ContactCard email={CONTACT_EMAIL} />
        </Section>
      </div>
    </LegalPage>
  );
}

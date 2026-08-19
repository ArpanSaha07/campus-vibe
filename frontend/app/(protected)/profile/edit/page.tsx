"use client";

import { Facebook, Instagram, Linkedin } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useEditableForm } from "@/app/hooks/useEditableForm";
import { emptyProfile, saveProfile } from "@/app/lib/profile";
import ProfileAvatar from "@/app/components/profile/ProfileAvatar";
import ToggleRow from "@/app/components/profile/edit/ToggleRow";
import SaveChangesBar from "@/app/components/profile/edit/SaveChangesBar";
import FormField, { inputClasses } from "@/app/components/ui/FormField";

const BIO_LIMIT = 500;

const NETWORKS = [
  {
    key: "instagram" as const,
    label: "Instagram",
    Icon: Instagram,
    hint: "instagram.com/your_name, or just your_name",
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    Icon: Facebook,
    hint: "facebook.com/your_name",
  },
  {
    key: "linkedin" as const,
    label: "LinkedIn",
    Icon: Linkedin,
    hint: "linkedin.com/in/your_name",
  },
];

/**
 * Name, photo, bio, links, and what of it other people get to see.
 *
 * Name is seeded from the account rather than the profile: it lives on `User`,
 * which the contract pins to the backend, while everything else here is
 * `UserProfile`. One form edits both, and the save seam will have to write to
 * two endpoints when they exist — which is why the draft keeps `name` beside
 * the profile rather than in a second form with its own Save.
 */
export default function EditProfilePage() {
  const { user } = useAuth();

  // ProtectedRoute renders nothing without a user; this satisfies the type.
  const { draft, setDraft, setField, dirty, commit } = useEditableForm({
    name: user?.name ?? "",
    ...emptyProfile(),
  });

  if (!user) return null;

  const bioLength = draft.bio?.length ?? 0;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-ink-900">Edit profile</h2>
      <p className="mt-1 text-ink-600">This is what other students see.</p>

      <div className="mt-8 space-y-6">
        <div className="flex items-center gap-5">
          <ProfileAvatar name={draft.name || user.name} />
          <div>
            <p className="font-semibold text-ink-900">Profile photo</p>
            {/* Said plainly rather than shown as a disabled upload button: a
                control that cannot be used is a worse answer than a sentence. */}
            <p className="mt-1 max-w-sm text-sm text-ink-600">
              Photo uploads aren&apos;t available yet. For now your profile shows the first
              letter of your name, and it follows the name below.
            </p>
          </div>
        </div>

        <FormField label="Name" htmlFor="name" hint="Shown on your profile and anywhere you post.">
          <input
            id="name"
            type="text"
            value={draft.name}
            maxLength={80}
            onChange={(event) => setField("name", event.target.value)}
            className={inputClasses}
          />
        </FormField>

        <FormField
          label="Bio"
          htmlFor="bio"
          hint={`${bioLength} of ${BIO_LIMIT} characters. Line breaks are kept.`}
        >
          <textarea
            id="bio"
            rows={5}
            maxLength={BIO_LIMIT}
            value={draft.bio ?? ""}
            onChange={(event) => setField("bio", event.target.value || null)}
            placeholder="A programmer looking to expand his social circle"
            className={`${inputClasses} resize-y`}
          />
        </FormField>
      </div>

      <section className="mt-10">
        <h3 className="font-display text-xl font-bold text-ink-900">Social media</h3>
        <p className="mt-1 text-sm text-ink-600">
          Any links you add appear as icons on your profile.
        </p>

        <div className="mt-4 space-y-5">
          {NETWORKS.map(({ key, label, Icon, hint }) => (
            <FormField key={key} label={label} htmlFor={key} hint={hint}>
              <div className="relative">
                <Icon
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600"
                  aria-hidden="true"
                />
                <input
                  id={key}
                  type="text"
                  value={draft.socialLinks[key] ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      socialLinks: {
                        ...current.socialLinks,
                        [key]: event.target.value || null,
                      },
                    }))
                  }
                  className={`${inputClasses} pl-11`}
                />
              </div>
            </FormField>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h3 className="font-display text-xl font-bold text-ink-900">What people can see</h3>
        {/* divide-y rather than a border on each row, so there is no hairline
            above the first one or below the last. */}
        <div className="mt-2 divide-y divide-mist-200">
          <ToggleRow
            title="Show interests"
            description="Anyone visiting your profile can see what you have picked."
            checked={draft.showInterests}
            onChange={(value) => setField("showInterests", value)}
            linkHref="/profile/edit/interests"
            linkLabel="Edit your interests"
          />
          <ToggleRow
            title="Show social media"
            description="Anyone visiting your profile can follow you elsewhere."
            checked={draft.showSocialLinks}
            onChange={(value) => setField("showSocialLinks", value)}
          />
        </div>
      </section>

      <SaveChangesBar
        dirty={dirty}
        onSave={async () => {
          const { name: _name, ...profile } = draft;
          await saveProfile(profile);
          commit();
        }}
      />
    </div>
  );
}

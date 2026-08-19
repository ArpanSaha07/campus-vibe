"use client";

import { useEditableForm } from "@/app/hooks/useEditableForm";
import { emptyProfile, saveProfile } from "@/app/lib/profile";
import InterestPicker from "@/app/components/profile/edit/InterestPicker";
import SaveChangesBar from "@/app/components/profile/edit/SaveChangesBar";

/**
 * Its own section, not a field on Edit profile.
 *
 * The picker is a full screen of controls — two filters and a grid of eighty
 * pills — and folding it into the profile form would bury the name and bio
 * under it. It is also the one part of a profile people come back to change on
 * its own, which is why the Show interests toggle links straight here.
 */
export default function InterestsPage() {
  const { draft, setField, dirty, commit } = useEditableForm(emptyProfile());

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-ink-900">Interests</h2>
      <p className="mt-1 text-ink-600">
        Pick what you are into and share it on your profile.
      </p>

      <div className="mt-8">
        <InterestPicker
          selected={draft.interests}
          onChange={(interests) => setField("interests", interests)}
        />
      </div>

      <SaveChangesBar
        dirty={dirty}
        onSave={async () => {
          await saveProfile(draft);
          commit();
        }}
      />
    </div>
  );
}

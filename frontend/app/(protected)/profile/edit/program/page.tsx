"use client";

import { useEffect } from "react";
import { useEditableForm } from "@/app/hooks/useEditableForm";
import { useProfile } from "@/app/lib/profile-context";
import { emptyProfile } from "@/app/lib/profile";
import { DEGREES, MCGILL_FACULTIES } from "@/app/lib/profile-options";
import SubjectPicker from "@/app/components/profile/edit/SubjectPicker";
import SaveChangesBar from "@/app/components/profile/edit/SaveChangesBar";
import ProfileSectionState from "@/app/components/profile/edit/ProfileSectionState";
import FormField, { selectClasses } from "@/app/components/ui/FormField";

/**
 * Degree, faculty and subjects.
 *
 * Two closed lists and one open one. Degree and faculty are enumerable and
 * shared — a hundred students typing `engineering` six different ways cannot be
 * matched against each other — while subjects are free text because no list of
 * courses would ever be complete enough to be worth the frustration.
 *
 * Both selects offer a blank first option rather than defaulting to the first
 * real value. Without it the form would claim on load that everyone is a
 * Bachelor's student in Agricultural and Environmental Sciences, and the only
 * way to say otherwise would be to notice and correct it.
 *
 * The draft is the *whole* profile even though this screen shows three fields
 * of it, because the save replaces everything. `useProfile` is what makes the
 * other fields real values rather than the nulls of an empty profile.
 */
export default function ProgramInfoPage() {
  const { profile, failed, save } = useProfile();
  const { draft, setField, dirty, commit, reinitialise } = useEditableForm(emptyProfile());

  useEffect(() => {
    if (profile) reinitialise(profile);
  }, [profile, reinitialise]);

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-ink-900">Program info</h2>
      <p className="mt-1 text-ink-600">
        What you study, so clubs in your field are easier to find.
      </p>

      <ProfileSectionState profile={profile} failed={failed} />

      {profile && (
        <>
          <div className="mt-8 space-y-6">
            <FormField label="Degree" htmlFor="degree">
              <select
                id="degree"
                value={draft.degree ?? ""}
                onChange={(event) => setField("degree", event.target.value || null)}
                className={selectClasses}
              >
                <option value="">Select a degree</option>
                {DEGREES.map((degree) => (
                  <option key={degree} value={degree}>
                    {degree}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Faculty"
              htmlFor="faculty"
              hint="Every McGill faculty and school."
            >
              <select
                id="faculty"
                value={draft.faculty ?? ""}
                onChange={(event) => setField("faculty", event.target.value || null)}
                className={selectClasses}
              >
                <option value="">Select a faculty</option>
                {MCGILL_FACULTIES.map((faculty) => (
                  <option key={faculty} value={faculty}>
                    {faculty}
                  </option>
                ))}
              </select>
            </FormField>

            <SubjectPicker
              subjects={draft.subjects}
              onChange={(subjects) => setField("subjects", subjects)}
            />
          </div>

          <SaveChangesBar
            dirty={dirty}
            onSave={async () => {
              await save(draft);
              commit();
            }}
          />
        </>
      )}
    </div>
  );
}

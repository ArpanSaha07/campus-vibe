import { instagramHandle, isEmailShaped, normaliseWebLink } from '@/app/lib/links';
import { ClubFormData, ClubSocialLinks, FormErrors } from '@/app/types';

/**
 * Which of the two creation paths is being validated.
 *
 * `create` is a platform admin filling in the whole form, logo included.
 * `propose` is an ordinary user submitting for review, where the logo is not
 * rendered at all — so validating it would fail the form on an input the user
 * was never shown. The contact links are on both paths; only whether the email
 * is *required* differs.
 */
export type ClubFormMode = 'create' | 'propose';

/**
 * The two that are plain links. `email` is an address and `instagram` is a
 * handle; each has its own rule below, and running either through the link
 * normaliser is exactly the mistake this list exists to avoid.
 */
const LINK_FIELDS: [keyof ClubSocialLinks, string][] = [
  ['website', 'Website'],
  ['facebook', 'Facebook'],
];

export async function validateClubForm(
  formData: ClubFormData,
  checkClubExists: (name: string) => Promise<boolean>,
  mode: ClubFormMode = 'create'
): Promise<FormErrors> {
  const newErrors: FormErrors = {};

  // Validate club name
  if (!formData.name.trim()) {
    newErrors.name = 'Club name is required';
  } else if (formData.name.length < 3) {
    newErrors.name = 'Club name must be at least 3 characters';
  } else if (formData.name.length > 100) {
    newErrors.name = 'Club name must be at most 100 characters';
  } else {
    try {
      const exists = await checkClubExists(formData.name);
      if (exists) {
        newErrors.name = 'A club with this name already exists';
      }
    } catch {
      // The check did not run. Treating that as "available" is the one answer
      // it must not give: the user is told the name is free and the create then
      // fails with a 409 they had no way to predict.
      newErrors.name =
        "Couldn't check whether that name is taken. Check your connection and try again.";
    }
  }

  // Validate description
  if (!formData.description.trim()) {
    newErrors.description = 'Description is required';
  } else if (formData.description.length < 10) {
    newErrors.description = 'Description must be at least 10 characters';
  } else if (formData.description.length > 1000) {
    newErrors.description = 'Description must be at most 1000 characters';
  }

  // The contact email is required on the admin path and optional on a proposal:
  // a student proposing a club may not have an address for it yet, and refusing
  // the form over one would be refusing the club. Both paths check the shape of
  // whatever *was* typed, because a wrong address is worse than no address.
  const email = formData.socialLinks.email.trim();
  if (mode === 'create' && !email) {
    newErrors.social = 'Email is required';
  } else if (email && !isEmailShaped(email)) {
    newErrors.social = 'Please enter a valid email address';
  }

  // The two links are checked here too, and this is not the control -- the
  // browser copy guards what the form submits, `WebLinks.normalise` on the
  // server is what refuses. Checking here is what turns a 400 nobody expected
  // into a message beside the field that caused it.
  for (const [field, label] of LINK_FIELDS) {
    const typed = formData.socialLinks[field].trim();
    if (typed && normaliseWebLink(typed) === null) {
      newErrors.social = `${label} must be a http or https link`;
      break;
    }
  }

  // Instagram is a handle, not a link: the field asks for `yourclub` and the
  // server builds the URL. A pasted instagram.com URL is accepted and reduced
  // to its handle, which is why this is not a plain pattern test.
  const instagram = formData.socialLinks.instagram.trim();
  if (!newErrors.social && instagram && instagramHandle(instagram) === null) {
    newErrors.social = 'Instagram should be your handle, like yourclub';
  }

  // The logo exists only on the admin path. A proposal has no club id to hang
  // an S3 key off, so the form renders no control for it.

  if (mode === 'propose' && formData.message.length > 2000) {
    newErrors.message = 'Message must be at most 2000 characters';
  }

  return newErrors;
}

/**
 * Validates a single file
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 5
): { valid: boolean; error?: string } {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File must be less than ${maxSizeMB}MB`,
    };
  }

  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: 'Please upload an image file',
    };
  }

  return { valid: true };
}

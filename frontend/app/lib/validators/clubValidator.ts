import { ClubFormData, FormErrors } from '@/app/types';

/**
 * Which of the two creation paths is being validated.
 *
 * `create` is a platform admin filling in the whole form, images and links
 * included. `propose` is an ordinary user submitting for review, where those
 * fields are not rendered at all — so validating them would fail the form on
 * inputs the user was never shown.
 */
export type ClubFormMode = 'create' | 'propose';

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

  // Images and social links exist only on the admin path. A proposal carries
  // neither — it has no club id to hang an S3 key off, so the form renders no
  // controls for them.
  if (mode === 'create') {
    if (formData.images.length > 10) {
      newErrors.images = 'Maximum 10 photos allowed';
    }

    // Validate social links - email is required
    if (!formData.socialLinks.email.trim()) {
      newErrors.social = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.socialLinks.email)) {
      newErrors.social = 'Please enter a valid email address';
    }
  }

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

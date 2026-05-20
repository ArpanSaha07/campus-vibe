import { ClubFormData, FormErrors } from '@/app/types';

export async function validateClubForm(
  formData: ClubFormData,
  checkClubExists: (name: string) => Promise<boolean>
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
    const exists = await checkClubExists(formData.name);
    if (exists) {
      newErrors.name = 'A club with this name already exists';
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

  // Validate images
  if (formData.images.length > 10) {
    newErrors.images = 'Maximum 10 photos allowed';
  }

  // Validate social links - email is required
  if (!formData.socialLinks.email.trim()) {
    newErrors.social = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.socialLinks.email)) {
    newErrors.social = 'Please enter a valid email address';
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

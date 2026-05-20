/**
 * Club API Service
 * Handles all API calls related to club operations
 */

/**
 * Check if a club with the given name already exists
 */
export async function checkClubNameExists(clubName: string): Promise<boolean> {
  if (!clubName.trim()) return false;

  try {
    const response = await fetch(
      `/api/clubs/check-name?name=${encodeURIComponent(clubName)}`
    );
    const data = await response.json();
    return data.exists || false;
  } catch (error) {
    console.error('Error checking club name:', error);
    throw new Error('Failed to check club name availability');
  }
}

/**
 * Create a new club with the provided form data
 */
export async function createClub(uploadFormData: FormData): Promise<void> {
  try {
    const response = await fetch('/api/clubs/create', {
      method: 'POST',
      body: uploadFormData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to create club');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An error occurred while creating the club');
  }
}

/**
 * Prepare FormData from club form data
 */
export function prepareClubFormData(
  name: string,
  description: string,
  logo: File | null,
  images: File[],
  socialLinks: Record<string, string>
): FormData {
  const formData = new FormData();

  formData.append('name', name);
  formData.append('description', description);

  if (logo) {
    formData.append('logo', logo);
  }

  images.forEach((image, index) => {
    formData.append(`image_${index}`, image);
  });

  formData.append('socialLinks', JSON.stringify(socialLinks));

  return formData;
}

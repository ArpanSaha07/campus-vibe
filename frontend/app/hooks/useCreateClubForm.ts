'use client';

import { useState, useRef, useCallback } from 'react';
import { ClubFormData, FormErrors } from '@/app/types';
import {
  validateClubForm,
  validateImageFile,
  type ClubFormMode,
} from '@/app/lib/validators/clubValidator';
import {
  checkClubNameExists,
  createClubWithMedia,
} from '@/app/lib/services/clubService';
import { proposeClub } from '@/app/lib/club-creation-requests';

export interface UseCreateClubFormReturn {
  formData: ClubFormData;
  errors: FormErrors;
  isSubmitting: boolean;
  logoPreview: string | null;
  imagePreviews: string[];
  logoInputRef: React.RefObject<HTMLInputElement>;
  imagesInputRef: React.RefObject<HTMLInputElement>;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImagesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: (index: number) => void;
  removeLogo: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setCategory: (slug: string | null) => void;
  setInterests: (slugs: string[]) => void;
}

/**
 * What the form does on submit, decided by who is filling it in.
 *
 * `create` posts to the admin-only create endpoint and then chains the logo,
 * banners and social links, all of which work now that the creating admin owns
 * the club. `propose` submits a text-only proposal for review and creates
 * nothing. See ADR-004.
 */
export type { ClubFormMode };

const EMPTY_FORM: ClubFormData = {
  name: '',
  description: '',
  logo: null,
  images: [],
  category: null,
  interests: [],
  socialLinks: {
    email: '',
    website: '',
    facebook: '',
    instagram: '',
  },
  message: '',
};

/**
 * @param mode which creation path this form is on — see {@link ClubFormMode}.
 * @param onSuccess told what was created: the new club's id on the admin path,
 *   or null when a proposal was submitted and no club exists yet. The caller
 *   needs the difference to decide where to send the user.
 */
export function useCreateClubForm(
  mode: ClubFormMode = 'create',
  onSuccess?: (createdClubId: string | null) => void
): UseCreateClubFormReturn {
  const [formData, setFormData] = useState<ClubFormData>({ ...EMPTY_FORM });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null!);
  const imagesInputRef = useRef<HTMLInputElement>(null!);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;

      if (name.startsWith('social_')) {
        const socialKey = name.replace('social_', '') as keyof typeof formData.socialLinks;
        setFormData((prev) => ({
          ...prev,
          socialLinks: {
            ...prev.socialLinks,
            [socialKey]: value,
          },
        }));
        if (errors.social) {
          setErrors((prev) => ({ ...prev, social: undefined }));
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
        if (errors[name as keyof FormErrors]) {
          setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
      }
    },
    [errors]
  );

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.valid) {
        setErrors((prev) => ({
          ...prev,
          logo: validation.error,
        }));
        return;
      }

      setFormData((prev) => ({ ...prev, logo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      if (errors.logo) {
        setErrors((prev) => ({ ...prev, logo: undefined }));
      }
    },
    [errors]
  );

  const handleImagesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      if (formData.images.length + files.length > 10) {
        setErrors((prev) => ({
          ...prev,
          images: 'Maximum 10 photos allowed',
        }));
        return;
      }

      const validFiles = files.filter((file) => {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          setErrors((prev) => ({
            ...prev,
            images: validation.error,
          }));
          return false;
        }
        return true;
      });

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...validFiles],
      }));

      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

      if (errors.images) {
        setErrors((prev) => ({ ...prev, images: undefined }));
      }
    },
    [formData.images.length, errors]
  );

  const removeImage = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeLogo = useCallback(() => {
    setFormData((prev) => ({ ...prev, logo: null }));
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  }, []);

  const setCategory = useCallback((slug: string | null) => {
    setFormData((prev) => ({ ...prev, category: slug }));
  }, []);

  const setInterests = useCallback((slugs: string[]) => {
    setFormData((prev) => ({ ...prev, interests: slugs }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      try {
        setIsSubmitting(true);

        // Validate form
        const newErrors = await validateClubForm(formData, checkClubNameExists, mode);
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
          return;
        }

        let createdClubId: string | null = null;

        if (mode === 'create') {
          // The club is created first, then the logo, banners and links are
          // attached to it — all three address /clubs/{id}, so they cannot go
          // in the same request. If one of them fails the club still exists and
          // the caller owns it, which is why the error below says so rather
          // than implying nothing happened.
          const club = await createClubWithMedia(
            {
              name: formData.name,
              description: formData.description,
              category: formData.category,
              interests: formData.interests,
            },
            {
              logo: formData.logo,
              images: formData.images,
              socialLinks: formData.socialLinks,
            }
          );
          createdClubId = club.clubId;
        } else {
          // Creates no club. An admin approving this is what creates one, and
          // installs the requester as its owner.
          await proposeClub({
            name: formData.name,
            description: formData.description,
            category: formData.category,
            interests: formData.interests,
            message: formData.message,
          });
        }

        // Reset form on success
        setFormData({ ...EMPTY_FORM });
        setLogoPreview(null);
        setImagePreviews([]);
        setErrors({});

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(createdClubId);
        }
      } catch (error) {
        console.error('Error creating club:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'An error occurred while creating the club';
        setErrors({ general: errorMessage });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, mode, onSuccess]
  );

  return {
    formData,
    errors,
    isSubmitting,
    logoPreview,
    imagePreviews,
    logoInputRef,
    imagesInputRef,
    handleInputChange,
    handleLogoChange,
    handleImagesChange,
    removeImage,
    removeLogo,
    handleSubmit,
    setCategory,
    setInterests,
  };
}

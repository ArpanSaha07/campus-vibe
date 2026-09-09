'use client';

import { useState, useRef, useCallback } from 'react';
import { ClubFormData, ClubSocialLinks, FormErrors } from '@/app/types';
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
import { parseApiError } from '@/app/lib/auth-errors';

export interface UseCreateClubFormReturn {
  formData: ClubFormData;
  errors: FormErrors;
  isSubmitting: boolean;
  logoPreview: string | null;
  logoInputRef: React.RefObject<HTMLInputElement>;
  handleInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeLogo: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setCategory: (slug: string | null) => void;
  setInterests: (slugs: string[]) => void;
  /** Clears the submission-level error, for the toast's dismiss control. */
  dismissGeneralError: () => void;
}

/**
 * What the form does on submit, decided by who is filling it in.
 *
 * `create` posts to the admin-only create endpoint and then chains the logo and
 * social links, both of which work now that the creating admin owns the club.
 * `propose` submits a text-only proposal for review and creates nothing. See
 * ADR-004.
 */
export type { ClubFormMode };

const EMPTY_FORM: ClubFormData = {
  name: '',
  description: '',
  logo: null,
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
  const logoInputRef = useRef<HTMLInputElement>(null!);

  // Read through a ref so `handleSubmit` does not have to be rebuilt whenever
  // the caller passes a fresh inline arrow -- which is every render, since the
  // callback closes over the router. Callers used to get a stale-identity
  // dependency instead, and one of them shipped a second argument to a hook
  // whose bundled signature still took one: `onSuccess` was then the string
  // 'create', truthy, and calling it threw `onSuccess is not a function` on a
  // club that had in fact been created. The typeof guard below is what makes
  // that impossible rather than merely unlikely.
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;

      if (name.startsWith('social_')) {
        // Keyed off the type rather than `typeof formData.socialLinks`, which
        // reads as a value reference to the linter and had it demanding
        // `formData` as a dependency of a callback that never looks at it.
        const socialKey = name.replace('social_', '') as keyof ClubSocialLinks;
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

  const dismissGeneralError = useCallback(() => {
    setErrors((prev) => ({ ...prev, general: undefined }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setIsSubmitting(true);
      let createdClubId: string | null = null;

      try {
        const newErrors = await validateClubForm(formData, checkClubNameExists, mode);
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
          return;
        }

        if (mode === 'create') {
          // The club is created first, then the logo and links are attached to
          // it — both address /clubs/{id}, so they cannot go in the same
          // request. If one of them fails the club still exists and the caller
          // owns it, which is why the message below says so rather than
          // implying nothing happened.
          const club = await createClubWithMedia(
            {
              name: formData.name,
              description: formData.description,
              category: formData.category,
              interests: formData.interests,
            },
            {
              logo: formData.logo,
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

        setFormData({ ...EMPTY_FORM });
        setLogoPreview(null);
        setErrors({});
      } catch (error) {
        console.error('Error creating club:', error);
        // Through parseApiError, not error.message: ApiError carries the raw
        // response body, so the message a user saw was a line of JSON. The
        // fallback is per mode because the two failures are not the same
        // event -- a proposal that fails created nothing, while a create that
        // fails after the POST leaves a club the caller already owns.
        setErrors({
          general: parseApiError(
            error,
            mode === 'create'
              ? "The club couldn't be created. Nothing was saved unless the club already appears under Manage — check there before trying again."
              : "Your proposal couldn't be submitted. Nothing was saved, so try again.",
          ),
        });
        return;
      } finally {
        setIsSubmitting(false);
      }

      // Outside the try on purpose. This callback navigates, refreshes the
      // managed-clubs list and revalidates a cache tag -- all after the write
      // has succeeded. Inside the try, any one of them throwing was reported as
      // `general`, so the form said the club could not be created while sitting
      // on top of a club that had been. A failure here is a failure to *leave*
      // the page, and the page it fails to leave is still correct.
      const callback = onSuccessRef.current;
      if (typeof callback === 'function') {
        callback(createdClubId);
      }
    },
    [formData, mode]
  );

  return {
    formData,
    errors,
    isSubmitting,
    logoPreview,
    logoInputRef,
    handleInputChange,
    handleLogoChange,
    removeLogo,
    handleSubmit,
    setCategory,
    setInterests,
    dismissGeneralError,
  };
}

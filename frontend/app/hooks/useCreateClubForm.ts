'use client';

import { useState, useRef, useCallback } from 'react';
import { ClubFormData, FormErrors } from '@/app/types';
import {
  validateClubForm,
  validateImageFile,
} from '@/app/lib/validators/clubValidator';
import {
  checkClubNameExists,
  createClub,
  prepareClubFormData,
} from '@/app/lib/services/clubService';

export interface UseCreateClubFormReturn {
  formData: ClubFormData;
  errors: FormErrors;
  isChecking: boolean;
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
}

export function useCreateClubForm(onSuccess?: () => void): UseCreateClubFormReturn {
  const [formData, setFormData] = useState<ClubFormData>({
    name: '',
    description: '',
    logo: null,
    images: [],
    socialLinks: {
      email: '',
      website: '',
      facebook: '',
      instagram: '',
    },
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isChecking, setIsChecking] = useState(false);
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      try {
        setIsSubmitting(true);

        // Validate form
        const newErrors = await validateClubForm(formData, checkClubNameExists);
        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
          return;
        }

        // Prepare and submit form data
        const uploadFormData = prepareClubFormData(
          formData.name,
          formData.description,
          formData.logo,
          formData.images,
          formData.socialLinks
        );

        await createClub(uploadFormData);

        // Reset form on success
        setFormData({
          name: '',
          description: '',
          logo: null,
          images: [],
          socialLinks: {
            email: '',
            website: '',
            facebook: '',
            instagram: '',
          },
        });
        setLogoPreview(null);
        setImagePreviews([]);
        setErrors({});

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
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
    [formData, onSuccess]
  );

  return {
    formData,
    errors,
    isChecking,
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
  };
}

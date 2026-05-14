'use client';

import { useState, useRef } from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import Image from 'next/image';

interface ClubFormData {
  name: string;
  description: string;
  logo: File | null;
  images: File[];
  socialLinks: {
    email: string;
    website: string;
    facebook: string;
    instagram: string;
  };
}

interface FormErrors {
  name?: string;
  description?: string;
  logo?: string;
  images?: string;
  social?: string;
  general?: string;
}

export default function CreateClubForm() {
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const checkClubExists = async (clubName: string): Promise<boolean> => {
    if (!clubName.trim()) return false;
    
    try {
      setIsChecking(true);
      const response = await fetch(`/api/clubs/check-name?name=${encodeURIComponent(clubName)}`);
      const data = await response.json();
      return data.exists || false;
    } catch (error) {
      console.error('Error checking club name:', error);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: FormErrors = {};

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

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'Description must be at most 1000 characters';
    }

    if (!formData.logo) {
      newErrors.logo = 'Club logo is required';
    }

    if (formData.images.length === 0) {
      newErrors.images = 'At least one club photo is required';
    } else if (formData.images.length > 10) {
      newErrors.images = 'Maximum 10 photos allowed';
    }

    const hasValidSocial = Object.values(formData.socialLinks).some(link => link.trim());
    if (!hasValidSocial && !formData.socialLinks.email.trim()) {
      newErrors.social = 'At least one contact method is required';
    }

    if (!formData.socialLinks.email.trim()) {
      newErrors.social = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.socialLinks.email)) {
      newErrors.social = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('social_')) {
      const socialKey = name.replace('social_', '') as keyof typeof formData.socialLinks;
      setFormData(prev => ({
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          [socialKey]: value,
        },
      }));
      if (errors.social) {
        setErrors(prev => ({ ...prev, social: undefined }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
      if (errors[name as keyof FormErrors]) {
        setErrors(prev => ({ ...prev, [name]: undefined }));
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logo: 'Logo must be less than 5MB' }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, logo: 'Please upload an image file' }));
        return;
      }
      setFormData(prev => ({ ...prev, logo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      if (errors.logo) {
        setErrors(prev => ({ ...prev, logo: undefined }));
      }
    }
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (formData.images.length + files.length > 10) {
      setErrors(prev => ({ ...prev, images: 'Maximum 10 photos allowed' }));
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, images: 'Each photo must be less than 5MB' }));
        return false;
      }
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, images: 'Please upload image files only' }));
        return false;
      }
      return true;
    });

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...validFiles],
    }));

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (errors.images) {
      setErrors(prev => ({ ...prev, images: undefined }));
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeLogo = () => {
    setFormData(prev => ({ ...prev, logo: null }));
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!(await validateForm())) {
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadFormData = new FormData();
      
      uploadFormData.append('name', formData.name);
      uploadFormData.append('description', formData.description);
      
      if (formData.logo) {
        uploadFormData.append('logo', formData.logo);
      }
      
      formData.images.forEach((image, index) => {
        uploadFormData.append(`image_${index}`, image);
      });
      
      uploadFormData.append('socialLinks', JSON.stringify(formData.socialLinks));

      const response = await fetch('/api/clubs/create', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const data = await response.json();
        setErrors({ general: data.message || 'Failed to create club' });
        return;
      }

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
      
      // Optionally redirect or show success message
      alert('Club created successfully!');
    } catch (error) {
      console.error('Error creating club:', error);
      setErrors({ general: 'An error occurred while creating the club' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create a New Club</h1>
          <p className="text-slate-400">Start building your campus community</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Club Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold mb-2">
              Club Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter club name"
              disabled={isChecking}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            {isChecking && <p className="text-blue-400 text-sm mt-1">Checking availability...</p>}
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe your club..."
              rows={4}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-slate-400 text-sm mt-1">
              {formData.description.length}/1000 characters
            </p>
            {errors.description && (
              <p className="text-red-400 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Club Logo */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Club Logo *
            </label>
            {!logoPreview ? (
              <div
                onClick={() => logoInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-700/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-300 text-sm">Click to upload logo</p>
                <p className="text-slate-500 text-xs">PNG, JPG up to 5MB</p>
              </div>
            ) : (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-slate-700">
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute top-1 right-1 bg-red-500 rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
            {errors.logo && (
              <p className="text-red-400 text-sm mt-1">{errors.logo}</p>
            )}
          </div>

          {/* Club Images */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Club Photos ({formData.images.length}/10) *
            </label>
            {imagePreviews.length === 0 ? (
              <div
                onClick={() => imagesInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-700/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-300 text-sm">Click to upload photos</p>
                <p className="text-slate-500 text-xs">PNG, JPG up to 5MB each</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden bg-slate-700">
                    <Image
                      src={preview}
                      alt={`Photo ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {formData.images.length < 10 && (
                  <div
                    onClick={() => imagesInputRef.current?.click()}
                    className="w-24 h-24 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-700/50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </div>
            )}
            <input
              ref={imagesInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesChange}
              className="hidden"
            />
            {errors.images && (
              <p className="text-red-400 text-sm mt-1">{errors.images}</p>
            )}
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact & Social Links</h3>
            
            {/* Email */}
            <div>
              <label htmlFor="social_email" className="block text-sm font-medium mb-2">
                Email *
              </label>
              <input
                type="email"
                id="social_email"
                name="social_email"
                value={formData.socialLinks.email}
                onChange={handleInputChange}
                placeholder="club@campus.edu"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Website */}
            <div>
              <label htmlFor="social_website" className="block text-sm font-medium mb-2">
                Website
              </label>
              <input
                type="url"
                id="social_website"
                name="social_website"
                value={formData.socialLinks.website}
                onChange={handleInputChange}
                placeholder="https://yourclub.com"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Facebook */}
            <div>
              <label htmlFor="social_facebook" className="block text-sm font-medium mb-2">
                Facebook
              </label>
              <input
                type="url"
                id="social_facebook"
                name="social_facebook"
                value={formData.socialLinks.facebook}
                onChange={handleInputChange}
                placeholder="https://facebook.com/yourclub"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Instagram */}
            <div>
              <label htmlFor="social_instagram" className="block text-sm font-medium mb-2">
                Instagram
              </label>
              <input
                type="text"
                id="social_instagram"
                name="social_instagram"
                value={formData.socialLinks.instagram}
                onChange={handleInputChange}
                placeholder="@yourclub"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {errors.social && (
              <p className="text-red-400 text-sm mt-1">{errors.social}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isChecking}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:opacity-50 font-semibold py-3 rounded-lg transition-colors duration-200"
          >
            {isSubmitting ? 'Creating Club...' : 'Create Club'}
          </button>
        </form>
      </div>
    </div>
  );
}

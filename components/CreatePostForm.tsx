'use client';

import React, { useRef, useState } from 'react';
import { AlertTriangle, Image as ImageIcon, Landmark, MapPin, MapPinned, Navigation, X } from 'lucide-react';
import { toast } from 'sonner';
import { createPost, Category, getPosts } from '@/lib/db';
import {
  COMPLAINT_CATEGORIES,
  findDuplicates,
  getJalandharAreasForPincode,
  isValidJalandharPincode,
  JALANDHAR_DISTRICT,
  JALANDHAR_PINCODE_OPTIONS,
  JALANDHAR_STATE,
  SLA_LABELS,
} from '@/lib/portal';
import { Button } from '@/components/ui/button';

interface CreatePostFormProps {
  userId: string;
  onPostCreated: () => void | Promise<void>;
}

export default function CreatePostForm({ userId, onPostCreated }: CreatePostFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Pothole');
  const [district] = useState(JALANDHAR_DISTRICT);
  const [locality, setLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const areaSuggestions = getJalandharAreasForPincode(pincode);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      return;
    }

    if (photos.length + files.length > 5) {
      toast.error('Maximum 5 photos allowed.');
      return;
    }

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 5MB limit.`);
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(previous => [...previous, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(previous => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const checkForDuplicates = async () => {
    if (title.trim().length < 5) return;
    try {
      const existingPosts = await getPosts();
      const dupes = findDuplicates(
        { title, category, locationDetails: { district, locality, ...(pincode ? { pincode } : {}) } },
        existingPosts,
      );
      if (dupes.length > 0) {
        setDuplicateWarning(`${dupes.length} similar complaint(s) already reported in this area. Your complaint will be grouped with them.`);
      } else {
        setDuplicateWarning('');
      }
    } catch {
      // Ignore errors in duplicate check
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (title.trim().length < 10) {
        throw new Error('Complaint title must be at least 10 characters.');
      }

      if (description.trim().length < 20) {
        throw new Error('Complaint description must be at least 20 characters.');
      }

      if (!isValidJalandharPincode(pincode)) {
        throw new Error('Please select a valid Jalandhar PIN code.');
      }

      if (!locality.trim()) {
        throw new Error('Please enter the exact location of the issue.');
      }

      const locationText = [locality, landmark, pincode, district, JALANDHAR_STATE].filter(Boolean).join(', ');
      await createPost(
        userId,
        title,
        description,
        category,
        locationText,
        photos,
        {
          state: JALANDHAR_STATE,
          district,
          locality,
          ...(landmark.trim() ? { landmark } : {}),
          pincode,
        },
      );

      await onPostCreated();

      setTitle('');
      setDescription('');
      setCategory('Pothole');
      setLocality('');
      setLandmark('');
      setPincode('');
      setPhotos([]);
      setDuplicateWarning('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to submit complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-foreground">Complaint title</span>
          <input
            type="text"
            value={title}
            onChange={event => setTitle(event.target.value)}
            onBlur={() => void checkForDuplicates()}
            placeholder="e.g. Large pothole near the market road junction"
            maxLength={100}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        {duplicateWarning && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 md:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Possible duplicate detected</p>
              <p className="mt-1">{duplicateWarning}</p>
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-foreground">Issue type</span>
          <select
            value={category}
            onChange={event => setCategory(event.target.value as Category)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          >
            {COMPLAINT_CATEGORIES.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            SLA deadline: <span className="font-semibold text-primary">{SLA_LABELS[category]}</span>
          </p>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Landmark className="h-4 w-4 text-primary" />
            State
          </span>
          <input
            type="text"
            value={JALANDHAR_STATE}
            readOnly
            className="w-full rounded-2xl border border-input bg-muted/30 px-4 py-3 text-sm text-foreground outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPinned className="h-4 w-4 text-primary" />
            District
          </span>
          <input
            type="text"
            value={district}
            readOnly
            className="w-full rounded-2xl border border-input bg-muted/30 px-4 py-3 text-sm text-foreground outline-none"
          />
          <p className="mt-2 text-xs text-muted-foreground">Complaints are currently accepted only for Jalandhar district.</p>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            Jalandhar PIN code
          </span>
          <select
            value={pincode}
            onChange={event => setPincode(event.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          >
            <option value="">Select PIN code...</option>
            {JALANDHAR_PINCODE_OPTIONS.map(option => (
              <option key={option.pincode} value={option.pincode}>
                {option.pincode} - {option.label}
              </option>
            ))}
          </select>
          {pincode && (
            <p className="mt-2 text-xs text-muted-foreground">
              Covered areas: {getJalandharAreasForPincode(pincode).join(', ')}
            </p>
          )}
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Navigation className="h-4 w-4 text-primary" />
            Exact issue location
          </span>
          <input
            type="text"
            value={locality}
            onChange={event => setLocality(event.target.value)}
            list="jalandhar-area-suggestions"
            placeholder="e.g. Model Town main road, near BMC Chowk"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <datalist id="jalandhar-area-suggestions">
            {areaSuggestions.map(area => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Navigation className="h-4 w-4 text-primary" />
            Landmark / nearby point
          </span>
          <input
            type="text"
            value={landmark}
            onChange={event => setLandmark(event.target.value)}
            placeholder="Near bus stand / school / market / chowk"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-foreground">Detailed description</span>
          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            rows={6}
            maxLength={500}
            placeholder="Describe the issue: what is happening, since when, who is affected, and whether it poses a safety risk."
            className="w-full rounded-[1.5rem] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/30 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Upload photo evidence</p>
            <p className="mt-1 text-sm text-muted-foreground">Add up to 5 photos so the municipality team can verify the issue faster.</p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              id="portal-photo-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <label
              htmlFor="portal-photo-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              <ImageIcon className="h-4 w-4" />
              Upload photos
            </label>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <div key={photo.slice(0, 24) + index} className="relative overflow-hidden rounded-[1.25rem] border border-border">
                <img src={photo} alt={`Upload ${index + 1}`} className="h-36 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute right-3 top-3 rounded-full bg-background/80 p-1.5 text-foreground transition hover:text-destructive"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {loading ? 'Submitting complaint...' : 'Submit complaint'}
      </Button>
    </form>
  );
}

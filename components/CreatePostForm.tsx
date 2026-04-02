'use client';

import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Landmark, MapPin, MapPinned, Navigation, X } from 'lucide-react';
import { toast } from 'sonner';
import { createPost, Category, Token } from '@/lib/db';
import { INDIA_STATES_AND_UTS } from '@/lib/portal';
import { Button } from '@/components/ui/button';

interface CreatePostFormProps {
  userId: string;
  onPostCreated: (token: Token) => void | Promise<void>;
}

const categories: Category[] = ['Infrastructure', 'Education', 'Electricity', 'Water', 'Roads', 'Healthcare', 'Other'];

export default function CreatePostForm({ userId, onPostCreated }: CreatePostFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Infrastructure');
  const [stateName, setStateName] = useState('Maharashtra');
  const [district, setDistrict] = useState('');
  const [locality, setLocality] = useState('');
  const [ward, setWard] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (!district.trim() || !locality.trim()) {
        throw new Error('District and locality are required for administration routing.');
      }

      const locationText = [locality, ward, district, stateName].filter(Boolean).join(', ');
      const { token } = await createPost(
        userId,
        title,
        description,
        category,
        locationText,
        photos,
        {
          state: stateName,
          district,
          locality,
          ...(ward.trim() ? { ward } : {}),
          ...(landmark.trim() ? { landmark } : {}),
          ...(pincode.trim() ? { pincode } : {}),
        },
      );

      await onPostCreated(token);

      setTitle('');
      setDescription('');
      setCategory('Infrastructure');
      setDistrict('');
      setLocality('');
      setWard('');
      setLandmark('');
      setPincode('');
      setPhotos([]);
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
            placeholder="Streetlight outage outside the primary health centre"
            maxLength={100}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-foreground">Category</span>
          <select
            value={category}
            onChange={event => setCategory(event.target.value as Category)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          >
            {categories.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Landmark className="h-4 w-4 text-primary" />
            State / Union Territory
          </span>
          <select
            value={stateName}
            onChange={event => setStateName(event.target.value)}
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
          >
            {INDIA_STATES_AND_UTS.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPinned className="h-4 w-4 text-primary" />
            District
          </span>
          <input
            type="text"
            value={district}
            onChange={event => setDistrict(event.target.value)}
            placeholder="Pune"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            Locality / village / ward area
          </span>
          <input
            type="text"
            value={locality}
            onChange={event => setLocality(event.target.value)}
            placeholder="Kothrud Depot"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-foreground">Ward / block</span>
          <input
            type="text"
            value={ward}
            onChange={event => setWard(event.target.value)}
            placeholder="Ward 12"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Navigation className="h-4 w-4 text-primary" />
            Landmark
          </span>
          <input
            type="text"
            value={landmark}
            onChange={event => setLandmark(event.target.value)}
            placeholder="Near bus stand / school / panchayat office"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-foreground">PIN code</span>
          <input
            type="text"
            value={pincode}
            onChange={event => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="411038"
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
            placeholder="Describe what is happening, when it started, who is affected, and whether the issue is urgent or unsafe."
            className="w-full rounded-[1.5rem] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/30 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Attach on-site evidence</p>
            <p className="mt-1 text-sm text-muted-foreground">Add up to 5 photos so the district team can verify the issue faster.</p>
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
        {loading ? 'Submitting complaint...' : 'Submit complaint to local administration'}
      </Button>
    </form>
  );
}

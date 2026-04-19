import type { Category, Post } from '@/lib/db';

export interface ComplaintLocation {
  state: string;
  district: string;
  locality: string;
  pincode?: string;
  ward?: string;
  landmark?: string;
}

/* ------------------------------------------------------------------ */
/*  Ward / Zone constants                                              */
/* ------------------------------------------------------------------ */

export const WARDS = Array.from({ length: 25 }, (_, i) => `Ward ${i + 1}`);

export const JALANDHAR_STATE = 'Punjab';
export const JALANDHAR_DISTRICT = 'Jalandhar';

export const JALANDHAR_PINCODE_OPTIONS = [
  {
    pincode: '144001',
    label: 'Civil Lines, Railway Station, Ladowali Road',
    areas: ['Civil Lines', 'Railway Station Area', 'Ladowali Road', 'Court Complex'],
  },
  {
    pincode: '144002',
    label: 'Model Town, Nehru Garden, BMC Chowk',
    areas: ['Model Town', 'Nehru Garden', 'BMC Chowk', 'Central Town'],
  },
  {
    pincode: '144003',
    label: 'Sodal, Industrial Area, Football Chowk',
    areas: ['Sodal Road', 'Industrial Area', 'Football Chowk', 'Old Jail Road'],
  },
  {
    pincode: '144004',
    label: 'Basti Sheikh, Kapurthala Road, Patel Nagar',
    areas: ['Basti Sheikh', 'Kapurthala Road', 'Patel Nagar', 'Basti Danishmanda'],
  },
  {
    pincode: '144005',
    label: 'Jalandhar Cantt, Garha, Deep Nagar',
    areas: ['Jalandhar Cantt', 'Garha', 'Deep Nagar', 'Mithapur Road'],
  },
  {
    pincode: '144006',
    label: 'Rama Mandi, Hoshiarpur Road, Khurla Kingra',
    areas: ['Rama Mandi', 'Hoshiarpur Road', 'Khurla Kingra', 'Suchi Pind'],
  },
  {
    pincode: '144008',
    label: 'Urban Estate, Wadala Chowk, Guru Gobind Singh Avenue',
    areas: ['Urban Estate Phase 1', 'Urban Estate Phase 2', 'Wadala Chowk', 'Guru Gobind Singh Avenue'],
  },
  {
    pincode: '144009',
    label: 'Surya Enclave, Bootan Mandi, 66 Feet Road',
    areas: ['Surya Enclave', 'Bootan Mandi', '66 Feet Road', 'New Jawahar Nagar'],
  },
] as const;

export function getJalandharAreasForPincode(pincode?: string) {
  return JALANDHAR_PINCODE_OPTIONS.find(option => option.pincode === pincode)?.areas || [];
}

export function isValidJalandharPincode(pincode?: string) {
  return !!pincode && JALANDHAR_PINCODE_OPTIONS.some(option => option.pincode === pincode);
}

/* ------------------------------------------------------------------ */
/*  Complaint categories aligned to spec                               */
/* ------------------------------------------------------------------ */

export const COMPLAINT_CATEGORIES: Category[] = [
  'Pothole',
  'Broken Streetlight',
  'Park Maintenance',
  'Locality Cleanliness',
];

export const CATEGORY_META: Record<Category, { department: string; accent: string; shortLabel: string; icon: string }> = {
  'Pothole': {
    department: 'Public Works Department',
    accent: 'from-[#475569] to-[#334155]',
    shortLabel: 'PWD',
    icon: '🕳️',
  },
  'Broken Streetlight': {
    department: 'Electrical Maintenance',
    accent: 'from-[#ca8a04] to-[#a16207]',
    shortLabel: 'EM',
    icon: '💡',
  },
  'Park Maintenance': {
    department: 'Parks & Gardens',
    accent: 'from-[#16a34a] to-[#15803d]',
    shortLabel: 'PG',
    icon: '🌳',
  },
  'Locality Cleanliness': {
    department: 'Sanitation Department',
    accent: 'from-[#0891b2] to-[#0e7490]',
    shortLabel: 'SD',
    icon: '🧹',
  },
};

/* ------------------------------------------------------------------ */
/*  SLA deadlines per complaint type                                   */
/* ------------------------------------------------------------------ */

/** SLA deadline in hours per complaint category */
export const SLA_DEADLINES: Record<Category, number> = {
  'Broken Streetlight': 48,
  'Pothole': 7 * 24,
  'Park Maintenance': 5 * 24,
  'Locality Cleanliness': 3 * 24,
};

/** Human-readable SLA label */
export const SLA_LABELS: Record<Category, string> = {
  'Broken Streetlight': '48 hours',
  'Pothole': '7 days',
  'Park Maintenance': '5 days',
  'Locality Cleanliness': '3 days',
};

/** Compute ISO string deadline from creation date and category */
export function computeSLADeadline(createdAt: string, category: Category): string {
  const hours = SLA_DEADLINES[category] || 7 * 24;
  const deadline = new Date(new Date(createdAt).getTime() + hours * 60 * 60 * 1000);
  return deadline.toISOString();
}

/** Check if SLA is breached */
export function isSLABreached(slaDeadline: string | undefined, status: string): boolean {
  if (!slaDeadline || status === 'resolved') return false;
  return new Date() > new Date(slaDeadline);
}

/** Get remaining hours until SLA breach (negative = breached) */
export function getSLARemainingHours(slaDeadline: string | undefined): number {
  if (!slaDeadline) return 0;
  const diff = new Date(slaDeadline).getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60));
}

/** Format SLA remaining as human-readable string */
export function formatSLARemaining(slaDeadline: string | undefined, status: string): string {
  if (status === 'resolved') return 'Resolved';
  if (!slaDeadline) return 'No SLA set';

  const hours = getSLARemainingHours(slaDeadline);

  if (hours < 0) {
    const breachedHours = Math.abs(hours);
    if (breachedHours >= 24) {
      return `Overdue by ${Math.floor(breachedHours / 24)}d ${breachedHours % 24}h`;
    }
    return `Overdue by ${breachedHours}h`;
  }

  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`;
  }

  return `${hours}h remaining`;
}

/* ------------------------------------------------------------------ */
/*  India states                                                       */
/* ------------------------------------------------------------------ */

export const INDIA_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

/* ------------------------------------------------------------------ */
/*  Location utilities                                                 */
/* ------------------------------------------------------------------ */

export function formatLocationLabel(location?: Partial<ComplaintLocation> | null, fallback?: string) {
  const segments = [location?.locality, location?.landmark, location?.pincode, location?.district, location?.state]
    .map(value => value?.trim())
    .filter(Boolean);

  if (segments.length > 0) {
    return segments.join(', ');
  }

  return fallback?.trim() || 'Location pending verification';
}

export function buildJurisdictionLabel(location?: Partial<ComplaintLocation> | null, fallback?: string) {
  const state = location?.state?.trim();
  const district = location?.district?.trim();
  const pincode = location?.pincode?.trim();

  if (district && state) {
    return `${district}, ${state}`;
  }

  if (district && pincode) {
    return `${district} ${pincode}`;
  }

  return formatLocationLabel(location, fallback);
}

export function getDepartmentForCategory(category: Category) {
  return CATEGORY_META[category]?.department || 'Municipal Administration';
}

/* ------------------------------------------------------------------ */
/*  Priority scoring                                                   */
/* ------------------------------------------------------------------ */

export function getComplaintPriority(post: Pick<Post, 'category' | 'status'> & { upvotes?: number; score?: number }) {
  const engagement = post.upvotes ?? post.score ?? 0;

  if (post.status === 'resolved') {
    return 'resolved';
  }

  // Safety-critical: Broken streetlights and potholes are safety issues
  if (post.category === 'Broken Streetlight' || post.category === 'Pothole') {
    if (engagement >= 15) return 'critical';
    return 'urgent';
  }

  if (engagement >= 20) {
    return 'urgent';
  }

  if (engagement >= 10) {
    return 'priority';
  }

  return 'standard';
}

export function computePostScore(post: {
  upvotes?: number;
  likes?: number;
  createdAt?: string;
}) {
  const upvotes = post.upvotes ?? post.likes ?? 0;
  const ageHours = Math.max(1, (Date.now() - new Date(post.createdAt || 0).getTime()) / (1000 * 60 * 60));
  return Math.round((upvotes * 10) - ageHours / 6);
}

/* ------------------------------------------------------------------ */
/*  Duplicate detection                                                */
/* ------------------------------------------------------------------ */

/** Simple similarity check using word overlap */
function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  wordsA.forEach(word => {
    if (wordsB.has(word)) overlap++;
  });

  return overlap / Math.max(wordsA.size, wordsB.size);
}

/** Check if two complaints are likely duplicates */
export function areLikelyDuplicates(
  postA: { title: string; category: string; locationDetails?: { ward?: string; pincode?: string; locality?: string; district?: string } },
  postB: { title: string; category: string; locationDetails?: { ward?: string; pincode?: string; locality?: string; district?: string } },
): boolean {
  // Must be same category
  if (postA.category !== postB.category) return false;

  const pincodeA = postA.locationDetails?.pincode?.trim().toLowerCase();
  const pincodeB = postB.locationDetails?.pincode?.trim().toLowerCase();
  if (pincodeA && pincodeB && pincodeA !== pincodeB) return false;

  const localityA = postA.locationDetails?.locality?.trim().toLowerCase();
  const localityB = postB.locationDetails?.locality?.trim().toLowerCase();
  if (localityA && localityB && localityA !== localityB) return false;

  const wardA = postA.locationDetails?.ward?.trim().toLowerCase();
  const wardB = postB.locationDetails?.ward?.trim().toLowerCase();
  if (wardA && wardB && wardA !== wardB) return false;

  // Title similarity threshold
  return wordOverlapScore(postA.title, postB.title) >= 0.5;
}

/** Find potential duplicates from a list of posts */
export function findDuplicates(
  newPost: { title: string; category: string; locationDetails?: { ward?: string; pincode?: string; locality?: string; district?: string } },
  existingPosts: Array<{ id: string; title: string; category: string; locationDetails?: { ward?: string; pincode?: string; locality?: string; district?: string } }>,
): string[] {
  return existingPosts
    .filter(existing => areLikelyDuplicates(newPost, existing))
    .map(p => p.id);
}

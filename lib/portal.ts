import type { Category, Post } from '@/lib/db';

export interface ComplaintLocation {
  state: string;
  district: string;
  locality: string;
  pincode?: string;
  ward?: string;
  landmark?: string;
}

export interface RewardOption {
  id: string;
  title: string;
  description: string;
  cost: number;
  audience: 'citizen' | 'authority' | 'all';
}

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

export const CATEGORY_META: Record<Category, { department: string; accent: string; shortLabel: string }> = {
  Infrastructure: { department: 'Urban Development', accent: 'from-[#f97316] to-[#ea580c]', shortLabel: 'UD' },
  Education: { department: 'School Education', accent: 'from-[#2563eb] to-[#1d4ed8]', shortLabel: 'ED' },
  Electricity: { department: 'Power Distribution', accent: 'from-[#ca8a04] to-[#a16207]', shortLabel: 'PW' },
  Water: { department: 'Water Resources', accent: 'from-[#0891b2] to-[#0e7490]', shortLabel: 'WT' },
  Roads: { department: 'Public Works Department', accent: 'from-[#475569] to-[#334155]', shortLabel: 'RD' },
  Healthcare: { department: 'Health Services', accent: 'from-[#dc2626] to-[#b91c1c]', shortLabel: 'HC' },
  Other: { department: 'District Administration', accent: 'from-[#7c3aed] to-[#6d28d9]', shortLabel: 'AD' },
};

export const REWARD_CATALOG: RewardOption[] = [
  {
    id: 'travel-pass',
    title: 'Public Transport Pass',
    description: 'Redeem coins for a civic mobility support voucher.',
    cost: 120,
    audience: 'all',
  },
  {
    id: 'digital-certificate',
    title: 'Digital Service Certificate',
    description: 'Recognition certificate for sustained community contribution.',
    cost: 180,
    audience: 'all',
  },
  {
    id: 'citizen-camp-priority',
    title: 'Citizen Camp Priority Slot',
    description: 'Priority slot at a scheduled district grievance camp.',
    cost: 220,
    audience: 'citizen',
  },
  {
    id: 'field-kit',
    title: 'Field Response Kit',
    description: 'Redeem for approved field support materials or equipment credits.',
    cost: 260,
    audience: 'authority',
  },
];

export function formatLocationLabel(location?: Partial<ComplaintLocation> | null, fallback?: string) {
  const segments = [location?.locality, location?.ward, location?.district, location?.state]
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
  const locality = location?.locality?.trim();

  if (district && state) {
    return `${district}, ${state}`;
  }

  if (locality && district) {
    return `${locality}, ${district}`;
  }

  return formatLocationLabel(location, fallback);
}

export function getDepartmentForCategory(category: Category) {
  return CATEGORY_META[category]?.department || CATEGORY_META.Other.department;
}

export function getComplaintPriority(post: Pick<Post, 'category' | 'status'> & { likes?: number; score?: number }) {
  const engagement = post.score ?? post.likes ?? 0;

  if (post.status === 'resolved') {
    return 'resolved';
  }

  if (post.category === 'Healthcare' || engagement >= 25) {
    return 'urgent';
  }

  if (post.category === 'Electricity' || post.category === 'Water' || engagement >= 10) {
    return 'priority';
  }

  return 'standard';
}

export function computePostScore(post: {
  likes?: number;
  dislikes?: number;
  upvotes?: number;
  createdAt?: string;
}) {
  const likes = post.likes ?? post.upvotes ?? 0;
  const dislikes = post.dislikes ?? 0;
  const engagement = likes - dislikes;
  const ageHours = Math.max(1, (Date.now() - new Date(post.createdAt || 0).getTime()) / (1000 * 60 * 60));
  return Math.round((engagement * 8) + (likes * 2) - ageHours / 6);
}

export function getRewardOptionsForRole(role: 'citizen' | 'authority' | 'admin') {
  if (role === 'admin') {
    return REWARD_CATALOG.filter(option => option.audience === 'all');
  }

  return REWARD_CATALOG.filter(option => option.audience === role || option.audience === 'all');
}

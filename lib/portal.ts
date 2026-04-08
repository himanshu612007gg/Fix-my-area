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
  providerName: string;
  faceValue: string;
  rewardKind: 'gift-card' | 'service-benefit' | 'certificate';
  settlementChannel: string;
  includes: string[];
  deliveryWindow: string;
  fulfillmentType: 'instant' | 'scheduled';
  fulfillmentNote: string;
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
    id: 'national-essentials-card',
    title: 'National Essentials Gift Card',
    description: 'A professionally issued digital gift card for daily essentials and partner marketplace purchases.',
    cost: 120,
    audience: 'all',
    providerName: 'National Consumer Cooperative',
    faceValue: 'Rs.150 stored value',
    rewardKind: 'gift-card',
    settlementChannel: 'National Rewards Settlement Desk',
    includes: ['Instant coupon code', '4-digit claim PIN', 'Partner checkout usage note'],
    deliveryWindow: 'Instant digital issuance',
    fulfillmentType: 'instant',
    fulfillmentNote: 'A secured coupon code and claim PIN are issued immediately and recorded in your redemption ledger.',
  },
  {
    id: 'mobility-topup-card',
    title: 'Urban Mobility Gift Card',
    description: 'Digital transit and mobility top-up card suited for metro, bus, and approved travel partner recharges.',
    cost: 180,
    audience: 'all',
    providerName: 'Integrated Transit Partner Network',
    faceValue: 'Rs.220 transit value',
    rewardKind: 'gift-card',
    settlementChannel: 'Mobility Benefits Counter',
    includes: ['Redeemable coupon code', 'Transit partner PIN', 'Usage receipt reference'],
    deliveryWindow: 'Instant access',
    fulfillmentType: 'instant',
    fulfillmentNote: 'The wallet settles the redemption instantly and stores the transit coupon in your gift card vault.',
  },
  {
    id: 'citizen-family-care-card',
    title: 'Citizen Family Care Gift Card',
    description: 'A higher-tier citizen reward with a reusable digital coupon for approved wellness and family services.',
    cost: 220,
    audience: 'citizen',
    providerName: 'Jan Seva Citizen Benefits Cell',
    faceValue: 'Rs.275 citizen benefit value',
    rewardKind: 'gift-card',
    settlementChannel: 'District Citizen Rewards Cell',
    includes: ['Secure coupon code', 'Claim PIN', 'Citizen benefits receipt note'],
    deliveryWindow: 'Instant access',
    fulfillmentType: 'instant',
    fulfillmentNote: 'Citizen benefit cards are issued instantly after balance verification and remain available in transaction history.',
  },
  {
    id: 'field-support-card',
    title: 'Field Support Gift Card',
    description: 'A controlled operational gift card for workers and field authorities to claim approved support value.',
    cost: 260,
    audience: 'authority',
    providerName: 'Public Works Support Desk',
    faceValue: 'Rs.320 operational value',
    rewardKind: 'gift-card',
    settlementChannel: 'Field Logistics Redemption Unit',
    includes: ['Operational coupon code', '4-digit release PIN', 'Settlement audit reference'],
    deliveryWindow: 'Instant access',
    fulfillmentType: 'instant',
    fulfillmentNote: 'Operational support cards are released instantly and the coupon remains available for audit and re-copy.',
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

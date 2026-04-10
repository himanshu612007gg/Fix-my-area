'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { waitForFirebaseUser } from '@/lib/firebase-auth';
import {
  type ComplaintLocation,
  type RewardOption,
  buildJurisdictionLabel,
  computePostScore,
  formatLocationLabel,
  getComplaintPriority,
  getDepartmentForCategory,
} from '@/lib/portal';

export const ADMIN_USERNAME = 'r@bbit';
export const ADMIN_PASSWORD = 'g@j@r@2007';
export const ADMIN_EMAIL = 'rbt.ctrl.2007@community-portal.local';

export type UserRole = 'citizen' | 'authority' | 'admin';
export type UserApprovalStatus = 'not-required' | 'pending' | 'approved' | 'rejected';
export type AuthMode = 'signin' | 'signup';
export type Category = 'Infrastructure' | 'Education' | 'Electricity' | 'Water' | 'Roads' | 'Healthcare' | 'Other';
export type BadgeType =
  | 'pothole-patrol'
  | 'cleanliness-captain'
  | 'safety-scout'
  | 'water-warrior'
  | 'power-champion'
  | 'health-hero'
  | 'community-leader'
  | 'rising-star'
  | 'veteran-reporter';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  approvalStatus: UserApprovalStatus;
  authProvider?: 'google' | 'password' | 'internal';
  firebaseUid?: string;
  approvedAt?: string;
  approvedBy?: string;
  googleId?: string;
  avatarUrl?: string;
}

export interface GoogleAuthProfile {
  email: string;
  name: string;
  googleId: string;
  avatarUrl?: string;
}

export interface FirebasePasswordProfile {
  uid: string;
  email: string;
  name: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: Category;
  location?: string;
  locationDetails?: ComplaintLocation;
  photos: string[];
  upvotes: number;
  userUpvotes: string[];
  likes: number;
  dislikes: number;
  userLikes: string[];
  userDislikes: string[];
  score: number;
  comments: Comment[];
  createdAt: string;
  submittedToGov: boolean;
  submittedToGovAt?: string;
  isReported: boolean;
  reportedAt?: string;
  assignedDepartment: string;
  assignedOffice: string;
  jurisdictionLabel: string;
  referenceNumber: string;
  status: 'open' | 'in-progress' | 'resolved';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionPhoto?: string;
  resolutionNotes?: string;
}

export interface GovernmentSubmission {
  id: string;
  postId: string;
  post: Post;
  submittedAt: string;
  status: 'received' | 'processing' | 'resolved';
}

export interface Badge {
  id: BadgeType;
  name: string;
  description: string;
  icon: string;
  category: Category | 'General';
  requirement: string;
  earnedAt?: string;
}

export interface UserStats {
  userId: string;
  points: number;
  level: number;
  badges: BadgeType[];
  postsCreated: number;
  upvotesReceived: number;
  issuesResolved: number;
  lastLoginDate: string;
  resolverPoints: number;
  creditCoins: number;
  redeemedCoins: number;
}

export interface Token {
  id: string;
  userId: string;
  postId: string;
  postTitle: string;
  category: string;
  issuedAt: string;
  status: 'active' | 'redeemed';
}

export interface RewardRedemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardTitle: string;
  rewardDescription: string;
  rewardKind: RewardOption['rewardKind'];
  providerName: string;
  faceValue: string;
  rewardItems: string[];
  cost: number;
  redeemedAt: string;
  status: 'processing' | 'fulfilled';
  deliveryWindow: string;
  deliveryNote: string;
  settlementChannel: string;
  transactionReference: string;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  couponCode?: string;
  couponPin?: string;
}

export type PostReaction = 'like' | 'dislike';

const CURRENT_USER_KEY = 'local_issues_current_user';
const REWARD_HISTORY_KEY_PREFIX = 'local_reward_redemptions_';
const USER_STATS_KEY_PREFIX = 'local_user_stats_';
export const WALLET_SYNC_EVENT = 'community-portal:wallet-sync';
const COLLECTIONS = {
  users: 'users',
  posts: 'posts',
  submissions: 'governmentSubmissions',
  userStats: 'userStats',
  tokens: 'tokens',
  rewardRedemptions: 'rewardRedemptions',
} as const;

export const BADGE_DEFINITIONS: Record<BadgeType, Omit<Badge, 'earnedAt'>> = {
  'pothole-patrol': {
    id: 'pothole-patrol',
    name: 'Pothole Patrol',
    description: 'Report 5 road or infrastructure issues',
    icon: 'RD',
    category: 'Roads',
    requirement: 'Report 5 road/infrastructure issues',
  },
  'cleanliness-captain': {
    id: 'cleanliness-captain',
    name: 'Cleanliness Captain',
    description: 'Champion of community cleanliness',
    icon: 'CL',
    category: 'Other',
    requirement: 'Report 5 cleanliness/sanitation issues',
  },
  'safety-scout': {
    id: 'safety-scout',
    name: 'Safety Scout',
    description: 'Vigilant guardian of community safety',
    icon: 'SF',
    category: 'Other',
    requirement: 'Report 5 safety/security issues',
  },
  'water-warrior': {
    id: 'water-warrior',
    name: 'Water Warrior',
    description: 'Defender of water resources',
    icon: 'WT',
    category: 'Water',
    requirement: 'Report 5 water-related issues',
  },
  'power-champion': {
    id: 'power-champion',
    name: 'Power Champion',
    description: 'Electricity issue expert',
    icon: 'PW',
    category: 'Electricity',
    requirement: 'Report 5 electricity issues',
  },
  'health-hero': {
    id: 'health-hero',
    name: 'Health Hero',
    description: 'Healthcare advocate',
    icon: 'HL',
    category: 'Healthcare',
    requirement: 'Report 5 healthcare issues',
  },
  'community-leader': {
    id: 'community-leader',
    name: 'Community Leader',
    description: 'Top contributor with 1000+ civic impact points',
    icon: 'LD',
    category: 'General',
    requirement: 'Earn 1000+ civic impact points',
  },
  'rising-star': {
    id: 'rising-star',
    name: 'Rising Star',
    description: 'Earn strong public support on 3 complaints',
    icon: 'RS',
    category: 'General',
    requirement: 'Receive 25+ support votes on 3 complaints',
  },
  'veteran-reporter': {
    id: 'veteran-reporter',
    name: 'Veteran Reporter',
    description: 'Long-term community contributor',
    icon: 'VR',
    category: 'General',
    requirement: 'Active for 30+ days with 20+ posts',
  },
};

function getDb() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet.');
  }

  return getFirestoreDb();
}

function usersCollection() {
  return collection(getDb(), COLLECTIONS.users);
}

function postsCollection() {
  return collection(getDb(), COLLECTIONS.posts);
}

function submissionsCollection() {
  return collection(getDb(), COLLECTIONS.submissions);
}

function userStatsCollection() {
  return collection(getDb(), COLLECTIONS.userStats);
}

function tokensCollection() {
  return collection(getDb(), COLLECTIONS.tokens);
}

function rewardRedemptionsCollection() {
  return collection(getDb(), COLLECTIONS.rewardRedemptions);
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function getNowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function randomAlphaNumeric(length: number) {
  const source = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (source.length >= length) {
    return source.slice(0, length);
  }

  return `${source}${Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '')}`.slice(0, length);
}

function generateCouponCode() {
  return `${randomAlphaNumeric(4)}-${randomAlphaNumeric(4)}-${randomAlphaNumeric(4)}`;
}

function generateCouponPin() {
  return `${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateTransactionReference() {
  return `NRX-${Date.now().toString().slice(-8)}-${randomAlphaNumeric(4)}`;
}

function buildFallbackTransactionReference(id: string) {
  const compact = id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-8).padStart(8, '0');
  return `NRX-${compact}`;
}

function sortByDateDesc<T>(items: T[], pickDate: (item: T) => string | undefined) {
  return [...items].sort((a, b) => {
    const first = new Date(pickDate(a) || 0).getTime();
    const second = new Date(pickDate(b) || 0).getTime();
    return second - first;
  });
}

function normalizeRole(role: unknown): UserRole {
  if (role === 'admin') {
    return 'admin';
  }

  if (role === 'worker' || role === 'authority') {
    return 'authority';
  }

  return 'citizen';
}

function normalizeApprovalStatus(data: Partial<User>, role: UserRole): UserApprovalStatus {
  if (role === 'admin' || role === 'citizen') {
    return 'not-required';
  }

  if (
    data.approvalStatus === 'pending' ||
    data.approvalStatus === 'approved' ||
    data.approvalStatus === 'rejected'
  ) {
    return data.approvalStatus;
  }

  // Legacy "worker" accounts were effectively trusted already.
  if ((data.role as string | undefined) === 'worker') {
    return 'approved';
  }

  return 'pending';
}

function normalizeComment(postId: string, comment: Partial<Comment>): Comment {
  return {
    id: comment.id || generateId('comment'),
    postId,
    userId: comment.userId || '',
    text: comment.text || '',
    createdAt: comment.createdAt || getNowIso(),
  };
}

function normalizeUser(id: string, data: Partial<User>): User {
  const role = normalizeRole(data.role);

  return {
    id,
    email: (data.email || '').trim().toLowerCase(),
    name: (data.name || '').trim() || 'Anonymous',
    role,
    createdAt: data.createdAt || getNowIso(),
    approvalStatus: normalizeApprovalStatus(data, role),
    authProvider: data.authProvider || (role === 'citizen' ? 'google' : role === 'authority' ? 'password' : 'internal'),
    ...(data.firebaseUid ? { firebaseUid: data.firebaseUid } : {}),
    ...(data.approvedAt ? { approvedAt: data.approvedAt } : {}),
    ...(data.approvedBy ? { approvedBy: data.approvedBy } : {}),
    ...(data.googleId ? { googleId: data.googleId } : {}),
    ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
  };
}

function normalizePost(id: string, data: Partial<Post>): Post {
  const status = data.status === 'in-progress' || data.status === 'resolved' ? data.status : 'open';
  const locationDetails = data.locationDetails
    ? {
        state: data.locationDetails.state || '',
        district: data.locationDetails.district || '',
        locality: data.locationDetails.locality || '',
        ...(data.locationDetails.pincode ? { pincode: data.locationDetails.pincode } : {}),
        ...(data.locationDetails.ward ? { ward: data.locationDetails.ward } : {}),
        ...(data.locationDetails.landmark ? { landmark: data.locationDetails.landmark } : {}),
      }
    : undefined;
  const likes = typeof data.likes === 'number' ? data.likes : typeof data.upvotes === 'number' ? data.upvotes : 0;
  const dislikes = typeof data.dislikes === 'number' ? data.dislikes : 0;
  const userLikes = Array.isArray(data.userLikes)
    ? data.userLikes.filter(Boolean)
    : Array.isArray(data.userUpvotes)
      ? data.userUpvotes.filter(Boolean)
      : [];
  const userDislikes = Array.isArray(data.userDislikes) ? data.userDislikes.filter(Boolean) : [];
  const locationLabel = formatLocationLabel(locationDetails, data.location);
  const assignedDepartment = data.assignedDepartment || getDepartmentForCategory((data.category as Category) || 'Other');
  const jurisdictionLabel = data.jurisdictionLabel || buildJurisdictionLabel(locationDetails, data.location);
  const referenceNumber = data.referenceNumber || `NCP-${id.slice(-8).toUpperCase()}`;

  return {
    id,
    userId: data.userId || '',
    title: data.title || '',
    description: data.description || '',
    category: (data.category as Category) || 'Other',
    ...(locationLabel ? { location: locationLabel } : {}),
    ...(locationDetails ? { locationDetails } : {}),
    photos: Array.isArray(data.photos) ? data.photos.filter(Boolean) : [],
    upvotes: likes,
    userUpvotes: userLikes,
    likes,
    dislikes,
    userLikes,
    userDislikes,
    score: typeof data.score === 'number' ? data.score : computePostScore({ likes, dislikes, createdAt: data.createdAt }),
    comments: Array.isArray(data.comments)
      ? data.comments.map(comment => normalizeComment(id, comment))
      : [],
    createdAt: data.createdAt || getNowIso(),
    submittedToGov: typeof data.submittedToGov === 'boolean' ? data.submittedToGov : true,
    ...(data.submittedToGovAt ? { submittedToGovAt: data.submittedToGovAt } : {}),
    isReported: typeof data.isReported === 'boolean' ? data.isReported : true,
    ...(data.reportedAt ? { reportedAt: data.reportedAt } : {}),
    assignedDepartment,
    assignedOffice: data.assignedOffice || `${jurisdictionLabel} Administration`,
    jurisdictionLabel,
    referenceNumber,
    status,
    ...(data.resolvedAt ? { resolvedAt: data.resolvedAt } : {}),
    ...(data.resolvedBy ? { resolvedBy: data.resolvedBy } : {}),
    ...(data.resolutionPhoto ? { resolutionPhoto: data.resolutionPhoto } : {}),
    ...(data.resolutionNotes ? { resolutionNotes: data.resolutionNotes } : {}),
  };
}

function normalizeSubmission(id: string, data: Partial<GovernmentSubmission>): GovernmentSubmission {
  return {
    id,
    postId: data.postId || data.post?.id || '',
    post: normalizePost(data.post?.id || data.postId || generateId('post'), data.post || {}),
    submittedAt: data.submittedAt || getNowIso(),
    status: data.status === 'processing' || data.status === 'resolved' ? data.status : 'received',
  };
}

function normalizeUserStats(userId: string, data: Partial<UserStats>): UserStats {
  const points = typeof data.points === 'number' ? data.points : 0;
  const resolverPoints = typeof data.resolverPoints === 'number' ? data.resolverPoints : 0;
  const creditCoins = typeof data.creditCoins === 'number' ? data.creditCoins : points + resolverPoints;

  return {
    userId,
    points,
    level: calculateLevel(points + resolverPoints),
    badges: Array.isArray(data.badges) ? data.badges.filter(Boolean) as BadgeType[] : [],
    postsCreated: typeof data.postsCreated === 'number' ? data.postsCreated : 0,
    upvotesReceived: typeof data.upvotesReceived === 'number' ? data.upvotesReceived : 0,
    issuesResolved: typeof data.issuesResolved === 'number' ? data.issuesResolved : 0,
    lastLoginDate: data.lastLoginDate || getNowIso(),
    resolverPoints,
    creditCoins,
    redeemedCoins: typeof data.redeemedCoins === 'number' ? data.redeemedCoins : 0,
  };
}

function normalizeToken(id: string, data: Partial<Token>): Token {
  return {
    id,
    userId: data.userId || '',
    postId: data.postId || '',
    postTitle: data.postTitle || '',
    category: data.category || 'Other',
    issuedAt: data.issuedAt || getNowIso(),
    status: data.status === 'redeemed' ? 'redeemed' : 'active',
  };
}

function normalizeRewardRedemption(id: string, data: Partial<RewardRedemption>): RewardRedemption {
  const walletBalanceAfter = typeof data.walletBalanceAfter === 'number' ? data.walletBalanceAfter : 0;
  const walletBalanceBefore = typeof data.walletBalanceBefore === 'number'
    ? data.walletBalanceBefore
    : walletBalanceAfter + (typeof data.cost === 'number' ? data.cost : 0);

  return {
    id,
    userId: data.userId || '',
    rewardId: data.rewardId || '',
    rewardTitle: data.rewardTitle || 'Portal reward',
    rewardDescription: data.rewardDescription || 'Community portal reward redemption',
    rewardKind: data.rewardKind || 'gift-card',
    providerName: data.providerName || 'National Rewards Desk',
    faceValue: data.faceValue || 'Benefit value pending confirmation',
    rewardItems: Array.isArray(data.rewardItems) ? data.rewardItems.filter(Boolean) : [],
    cost: typeof data.cost === 'number' ? data.cost : 0,
    redeemedAt: data.redeemedAt || getNowIso(),
    status: data.status === 'fulfilled' ? 'fulfilled' : 'processing',
    deliveryWindow: data.deliveryWindow || 'Pending confirmation',
    deliveryNote: data.deliveryNote || 'Reward request captured in the portal history.',
    settlementChannel: data.settlementChannel || 'National Rewards Settlement Desk',
    transactionReference: data.transactionReference || buildFallbackTransactionReference(id),
    walletBalanceBefore,
    walletBalanceAfter,
    ...(data.couponCode ? { couponCode: data.couponCode } : {}),
    ...(data.couponPin ? { couponPin: data.couponPin } : {}),
  };
}

function saveCurrentUser(user: User | null) {
  if (!isBrowser()) {
    return;
  }

  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function readCurrentUserCache(): User | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<User>;
    return normalizeUser(parsed.id || '', parsed);
  } catch {
    localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}

function getRewardHistoryStorageKey(userId: string) {
  return `${REWARD_HISTORY_KEY_PREFIX}${userId}`;
}

function getUserStatsStorageKey(userId: string) {
  return `${USER_STATS_KEY_PREFIX}${userId}`;
}

function emitWalletSync(userId: string, stats?: UserStats, redemption?: RewardRedemption) {
  if (!isBrowser() || !userId) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WALLET_SYNC_EVENT, {
      detail: {
        userId,
        ...(stats ? { stats } : {}),
        ...(redemption ? { redemption } : {}),
      },
    }),
  );
}

function readRewardRedemptionCache(userId: string): RewardRedemption[] {
  if (!isBrowser() || !userId) {
    return [];
  }

  const raw = localStorage.getItem(getRewardHistoryStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<RewardRedemption>>;
    return sortByDateDesc(
      parsed.map(entry => normalizeRewardRedemption(entry.id || generateId('reward'), entry)),
      redemption => redemption.redeemedAt,
    );
  } catch {
    localStorage.removeItem(getRewardHistoryStorageKey(userId));
    return [];
  }
}

function saveRewardRedemptionCache(userId: string, redemptions: RewardRedemption[]) {
  if (!isBrowser() || !userId) {
    return;
  }

  localStorage.setItem(getRewardHistoryStorageKey(userId), JSON.stringify(redemptions));
}

function readUserStatsCache(userId: string): UserStats | null {
  if (!isBrowser() || !userId) {
    return null;
  }

  const raw = localStorage.getItem(getUserStatsStorageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    return normalizeUserStats(userId, JSON.parse(raw) as Partial<UserStats>);
  } catch {
    localStorage.removeItem(getUserStatsStorageKey(userId));
    return null;
  }
}

function saveUserStatsCache(userId: string, stats: UserStats) {
  if (!isBrowser() || !userId) {
    return;
  }

  localStorage.setItem(getUserStatsStorageKey(userId), JSON.stringify(stats));
}

function mergeRewardRedemptions(primary: RewardRedemption[], secondary: RewardRedemption[]) {
  const merged = new Map<string, RewardRedemption>();

  [...secondary, ...primary].forEach(entry => {
    const normalized = normalizeRewardRedemption(entry.id, entry);
    merged.set(normalized.id, normalized);
  });

  return sortByDateDesc([...merged.values()], redemption => redemption.redeemedAt);
}

async function persistUser(user: User) {
  await setDoc(doc(usersCollection(), user.id), user);
}

async function persistPost(post: Post) {
  await setDoc(doc(postsCollection(), post.id), post);
}

async function persistSubmission(submission: GovernmentSubmission) {
  await setDoc(doc(submissionsCollection(), submission.id), submission);
}

async function persistUserStats(stats: UserStats) {
  const normalized = normalizeUserStats(stats.userId, stats);
  saveUserStatsCache(normalized.userId, normalized);
  emitWalletSync(normalized.userId, normalized);
  await setDoc(doc(userStatsCollection(), normalized.userId), normalized);
}

async function persistToken(token: Token) {
  await setDoc(doc(tokensCollection(), token.id), token);
}

async function persistRewardRedemption(redemption: RewardRedemption) {
  const normalized = normalizeRewardRedemption(redemption.id, redemption);
  const cached = readRewardRedemptionCache(normalized.userId);
  const nextCached = mergeRewardRedemptions([normalized], cached);

  saveRewardRedemptionCache(normalized.userId, nextCached);
  emitWalletSync(normalized.userId, undefined, normalized);

  try {
    await setDoc(doc(rewardRedemptionsCollection(), normalized.id), normalized);
  } catch {
    // Keep the wallet usable even when the optional history collection
    // is unavailable or its Firestore rules haven't been deployed yet.
  }
}

async function ensureUserStats(userId: string) {
  const existing = await getUserStats(userId);
  return existing;
}

async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const snapshot = await getDocs(query(usersCollection(), where('email', '==', normalizedEmail), limit(1)));

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  return normalizeUser(match.id, match.data() as Partial<User>);
}

async function getUserByFirebaseUid(firebaseUid: string) {
  if (!firebaseUid) {
    return null;
  }

  const byId = await getUserById(firebaseUid);
  if (byId) {
    return byId;
  }

  const snapshot = await getDocs(query(usersCollection(), where('firebaseUid', '==', firebaseUid), limit(1)));

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  return normalizeUser(match.id, match.data() as Partial<User>);
}

async function getSubmissionByPostId(postId: string) {
  const snapshot = await getDocs(query(submissionsCollection(), where('postId', '==', postId), limit(1)));

  if (snapshot.empty) {
    return null;
  }

  const match = snapshot.docs[0];
  return normalizeSubmission(match.id, match.data() as Partial<GovernmentSubmission>);
}

async function upsertSubmissionForPost(post: Post, fallbackStatus: GovernmentSubmission['status'] = 'received') {
  const existing = await getSubmissionByPostId(post.id);
  const submission: GovernmentSubmission = {
    id: existing?.id || generateId('submission'),
    postId: post.id,
    post,
    submittedAt: existing?.submittedAt || post.reportedAt || getNowIso(),
    status: existing?.status || fallbackStatus,
  };

  await persistSubmission(submission);
  return submission;
}

async function deleteSubmissionByPostId(postId: string) {
  const existing = await getSubmissionByPostId(postId);

  if (existing) {
    await deleteDoc(doc(submissionsCollection(), existing.id));
  }
}

async function issueToken(userId: string, postId: string, postTitle: string, category: string) {
  const token: Token = {
    id: `TKN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    userId,
    postId,
    postTitle,
    category,
    issuedAt: getNowIso(),
    status: 'active',
  };

  await persistToken(token);
  return token;
}

export async function initializeDB() {
  return;
}

export function isAuthorityApproved(user: User | null | undefined) {
  return user?.role === 'authority' && user.approvalStatus === 'approved';
}

export async function authenticateWithGoogle(profile: GoogleAuthProfile, mode: AuthMode): Promise<User> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const normalizedName = profile.name.trim() || normalizedEmail.split('@')[0];
  const existingById = await getUserByFirebaseUid(profile.googleId);
  const existingByEmail = existingById ? null : await getUserByEmail(normalizedEmail);
  const existingUser = existingById || existingByEmail;

  if (!existingUser) {
    if (mode === 'signin') {
      throw new Error('No account found for this Google profile. Please sign up first.');
    }

    const newUser: User = {
      id: profile.googleId,
      email: normalizedEmail,
      name: normalizedName,
      role: 'citizen',
      createdAt: getNowIso(),
      approvalStatus: 'not-required',
      authProvider: 'google',
      firebaseUid: profile.googleId,
      googleId: profile.googleId,
      ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    };

    await persistUser(newUser);
    await persistUserStats(normalizeUserStats(newUser.id, { userId: newUser.id }));
    saveCurrentUser(newUser);
    return newUser;
  }

  if (existingUser.role !== 'citizen') {
    throw new Error('This Google account belongs to a protected staff account. Use the authority sign-in section.');
  }

  if (mode === 'signup') {
    throw new Error('Account already exists. Please sign in instead.');
  }

  const updatedUser: User = normalizeUser(existingUser.id, {
    ...existingUser,
    email: normalizedEmail,
    name: existingUser.name || normalizedName,
    firebaseUid: profile.googleId,
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl || existingUser.avatarUrl,
  });

  await persistUser(updatedUser);

  const currentStats = await ensureUserStats(updatedUser.id);
  await persistUserStats({
    ...currentStats,
    lastLoginDate: getNowIso(),
  });

  saveCurrentUser(updatedUser);
  return updatedUser;
}

export async function authenticateCitizenPassword(profile: FirebasePasswordProfile, mode: AuthMode): Promise<User> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const normalizedName = profile.name.trim() || normalizedEmail.split('@')[0];
  const existingByUid = await getUserByFirebaseUid(profile.uid);
  const existingByEmail = existingByUid ? null : await getUserByEmail(normalizedEmail);
  const existingUser = existingByUid || existingByEmail;

  if (!existingUser) {
    if (mode === 'signin') {
      throw new Error('No citizen account found for this email. Please sign up first.');
    }

    const newUser: User = {
      id: profile.uid,
      email: normalizedEmail,
      name: normalizedName,
      role: 'citizen',
      createdAt: getNowIso(),
      approvalStatus: 'not-required',
      authProvider: 'password',
      firebaseUid: profile.uid,
    };

    await persistUser(newUser);
    await persistUserStats(normalizeUserStats(newUser.id, { userId: newUser.id }));
    saveCurrentUser(newUser);
    return newUser;
  }

  if (existingUser.role !== 'citizen') {
    throw new Error('This email belongs to a protected staff account. Use the authority sign-in section.');
  }

  if (mode === 'signup') {
    throw new Error('Citizen account already exists. Please sign in instead.');
  }

  const updatedUser: User = normalizeUser(existingUser.id, {
    ...existingUser,
    email: normalizedEmail,
    name: existingUser.name || normalizedName,
    authProvider: 'password',
    firebaseUid: profile.uid,
  });

  await persistUser(updatedUser);

  const currentStats = await ensureUserStats(updatedUser.id);
  await persistUserStats({
    ...currentStats,
    lastLoginDate: getNowIso(),
  });

  saveCurrentUser(updatedUser);
  return updatedUser;
}

export async function authenticateAuthority(profile: FirebasePasswordProfile, mode: AuthMode): Promise<User> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const normalizedName = profile.name.trim() || normalizedEmail.split('@')[0];
  const existingByUid = await getUserByFirebaseUid(profile.uid);
  const existingByEmail = existingByUid ? null : await getUserByEmail(normalizedEmail);
  const existingUser = existingByUid || existingByEmail;

  if (!existingUser) {
    if (mode === 'signin') {
      throw new Error('No authority record found for this account. Please sign up first.');
    }

    const newUser: User = {
      id: profile.uid,
      email: normalizedEmail,
      name: normalizedName,
      role: 'authority',
      createdAt: getNowIso(),
      approvalStatus: 'pending',
      authProvider: 'password',
      firebaseUid: profile.uid,
    };

    await persistUser(newUser);
    await persistUserStats(normalizeUserStats(newUser.id, { userId: newUser.id }));
    saveCurrentUser(newUser);
    return newUser;
  }

  if (existingUser.role !== 'authority') {
    throw new Error('This account is not registered as a government authority.');
  }

  if (mode === 'signup') {
    throw new Error('An authority account already exists. Please sign in instead.');
  }

  const updatedUser = normalizeUser(existingUser.id, {
    ...existingUser,
    email: normalizedEmail,
    name: existingUser.name || normalizedName,
    authProvider: 'password',
    firebaseUid: profile.uid,
  });

  await persistUser(updatedUser);

  const currentStats = await ensureUserStats(updatedUser.id);
  await persistUserStats({
    ...currentStats,
    lastLoginDate: getNowIso(),
  });

  saveCurrentUser(updatedUser);
  return updatedUser;
}

export async function authenticateAdmin(profile: FirebasePasswordProfile): Promise<User> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const existingByUid = await getUserByFirebaseUid(profile.uid);
  const existingByEmail = existingByUid ? null : await getUserByEmail(normalizedEmail);
  const existingUser = existingByUid || existingByEmail;

  if (!existingUser) {
    const newUser: User = {
      id: profile.uid,
      email: normalizedEmail,
      name: profile.name.trim() || ADMIN_USERNAME,
      role: 'admin',
      createdAt: getNowIso(),
      approvalStatus: 'not-required',
      authProvider: 'password',
      firebaseUid: profile.uid,
    };

    await persistUser(newUser);
    saveCurrentUser(newUser);
    return newUser;
  }

  if (existingUser.role !== 'admin') {
    throw new Error('This Firebase account is not registered as admin.');
  }

  const updatedUser = normalizeUser(existingUser.id, {
    ...existingUser,
    email: normalizedEmail,
    name: existingUser.name || profile.name || ADMIN_USERNAME,
    authProvider: 'password',
    firebaseUid: profile.uid,
  });

  await persistUser(updatedUser);
  saveCurrentUser(updatedUser);
  return updatedUser;
}

export async function getCurrentUser(): Promise<User | null> {
  const cachedUser = readCurrentUserCache();

  if (!isFirebaseConfigured()) {
    return cachedUser;
  }

  const firebaseUser = await waitForFirebaseUser();
  if (!firebaseUser?.email) {
    saveCurrentUser(null);
    return null;
  }

  const byId = await getUserByFirebaseUid(firebaseUser.uid);
  const byEmail = byId ? null : await getUserByEmail(firebaseUser.email);
  const user = byId || byEmail;

  if (!user) {
    saveCurrentUser(null);
    return null;
  }

  const updatedUser = normalizeUser(user.id, {
    ...user,
    email: firebaseUser.email,
    firebaseUid: firebaseUser.uid,
    ...(user.authProvider === 'google' ? { googleId: firebaseUser.uid } : {}),
    avatarUrl: firebaseUser.photoURL || user.avatarUrl,
  });

  await persistUser(updatedUser);
  saveCurrentUser(updatedUser);
  return updatedUser;
}

export function logoutUser() {
  saveCurrentUser(null);
}

export async function getUserById(id: string): Promise<User | null> {
  if (!id) {
    return null;
  }

  const snapshot = await getDoc(doc(usersCollection(), id));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeUser(snapshot.id, snapshot.data() as Partial<User>);
}

export async function getAuthorityUsers(status?: Exclude<UserApprovalStatus, 'not-required'>): Promise<User[]> {
  const snapshot = await getDocs(query(usersCollection(), where('role', '==', 'authority')));
  const users = snapshot.docs
    .map(entry => normalizeUser(entry.id, entry.data() as Partial<User>))
    .filter(user => !status || user.approvalStatus === status);

  return sortByDateDesc(users, user => user.createdAt);
}

export async function updateAuthorityApproval(
  authorityUserId: string,
  status: Exclude<UserApprovalStatus, 'not-required'>,
  adminUserId: string,
): Promise<User> {
  const user = await getUserById(authorityUserId);

  if (!user) {
    throw new Error('Authority user not found.');
  }

  if (user.role !== 'authority') {
    throw new Error('Only authority accounts can be reviewed.');
  }

  const nextUser = normalizeUser(user.id, {
    ...user,
    approvalStatus: status,
    approvedAt: status === 'approved' ? getNowIso() : undefined,
    approvedBy: status === 'approved' ? adminUserId : undefined,
  });

  await persistUser(nextUser);
  return nextUser;
}

export async function getPosts(): Promise<Post[]> {
  const snapshot = await getDocs(query(postsCollection(), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(entry => normalizePost(entry.id, entry.data() as Partial<Post>));
}

export async function getPostById(id: string): Promise<Post | null> {
  if (!id) {
    return null;
  }

  const snapshot = await getDoc(doc(postsCollection(), id));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizePost(snapshot.id, snapshot.data() as Partial<Post>);
}

export async function getRegularPosts() {
  const posts = await getPosts();
  return posts.sort((first, second) => {
    const scoreDiff = (second.score ?? 0) - (first.score ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  });
}

export async function getReportedPosts() {
  const posts = await getPosts();
  return posts.filter(post => post.submittedToGov);
}

export async function getResolvedPosts() {
  const posts = await getPosts();
  return posts.filter(post => post.status === 'resolved');
}

export async function createPost(
  userId: string,
  title: string,
  description: string,
  category: Category,
  location?: string,
  photos: string[] = [],
  locationDetails?: ComplaintLocation,
): Promise<{ post: Post; token: Token }> {
  const now = getNowIso();
  const normalizedLocationDetails = locationDetails
    ? {
        state: locationDetails.state.trim(),
        district: locationDetails.district.trim(),
        locality: locationDetails.locality.trim(),
        ...(locationDetails.pincode?.trim() ? { pincode: locationDetails.pincode.trim() } : {}),
        ...(locationDetails.ward?.trim() ? { ward: locationDetails.ward.trim() } : {}),
        ...(locationDetails.landmark?.trim() ? { landmark: locationDetails.landmark.trim() } : {}),
      }
    : undefined;
  const jurisdictionLabel = buildJurisdictionLabel(normalizedLocationDetails, location);
  const post: Post = {
    id: generateId('post'),
    userId,
    title: title.trim(),
    description: description.trim(),
    category,
    ...(formatLocationLabel(normalizedLocationDetails, location).trim()
      ? { location: formatLocationLabel(normalizedLocationDetails, location).trim() }
      : {}),
    ...(normalizedLocationDetails ? { locationDetails: normalizedLocationDetails } : {}),
    photos,
    upvotes: 0,
    userUpvotes: [],
    likes: 0,
    dislikes: 0,
    userLikes: [],
    userDislikes: [],
    score: computePostScore({ likes: 0, dislikes: 0, createdAt: now }),
    comments: [],
    createdAt: now,
    submittedToGov: true,
    submittedToGovAt: now,
    isReported: true,
    reportedAt: now,
    assignedDepartment: getDepartmentForCategory(category),
    assignedOffice: `${jurisdictionLabel} Administration`,
    jurisdictionLabel,
    referenceNumber: `NCP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: 'open',
  };

  await persistPost(post);
  await upsertSubmissionForPost(post);

  const stats = await ensureUserStats(userId);
  const pointsToAward = stats.postsCreated === 0 ? 60 : 25;
  const coinAward = 30;

  await persistUserStats({
    ...stats,
    points: stats.points + pointsToAward,
    creditCoins: stats.creditCoins + coinAward,
    postsCreated: stats.postsCreated + 1,
  });

  const token = await issueToken(userId, post.id, post.title, post.category);
  return { post, token };
}

export async function reactToPost(postId: string, userId: string, reaction: PostReaction): Promise<Post> {
  const post = await getPostById(postId);

  if (!post) {
    throw new Error('Post not found');
  }

  const hasLiked = post.userLikes.includes(userId);
  const hasDisliked = post.userDislikes.includes(userId);

  if (reaction === 'like') {
    if (hasLiked) {
      post.userLikes = post.userLikes.filter(id => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.userLikes = [...post.userLikes, userId];
      post.likes += 1;

      if (hasDisliked) {
        post.userDislikes = post.userDislikes.filter(id => id !== userId);
        post.dislikes = Math.max(0, post.dislikes - 1);
      }

      const authorStats = await ensureUserStats(post.userId);
      await persistUserStats({
        ...authorStats,
        points: authorStats.points + 2,
        upvotesReceived: authorStats.upvotesReceived + 1,
      });
    }
  } else if (hasDisliked) {
    post.userDislikes = post.userDislikes.filter(id => id !== userId);
    post.dislikes = Math.max(0, post.dislikes - 1);
  } else {
    post.userDislikes = [...post.userDislikes, userId];
    post.dislikes += 1;

    if (hasLiked) {
      post.userLikes = post.userLikes.filter(id => id !== userId);
      post.likes = Math.max(0, post.likes - 1);
    }
  }

  post.upvotes = post.likes;
  post.userUpvotes = post.userLikes;
  post.score = computePostScore(post);

  await persistPost(post);

  if (post.submittedToGov) {
    await upsertSubmissionForPost(post);
  }

  return post;
}

export async function upvotePost(postId: string, userId: string): Promise<Post> {
  return reactToPost(postId, userId, 'like');
}

export async function submitPostToGovernment(post: Post) {
  const existingPost = await getPostById(post.id);
  const now = getNowIso();
  const updatedPost = normalizePost(post.id, {
    ...(existingPost || post),
    submittedToGov: true,
    submittedToGovAt: existingPost?.submittedToGovAt || post.submittedToGovAt || now,
    isReported: true,
    reportedAt: existingPost?.reportedAt || post.reportedAt || now,
  });

  await persistPost(updatedPost);
  await upsertSubmissionForPost(updatedPost);
}

export async function getGovernmentSubmissions(): Promise<GovernmentSubmission[]> {
  const posts = await getPosts();
  const postMap = new Map(posts.map(post => [post.id, post] as const));
  const snapshot = await getDocs(query(submissionsCollection(), orderBy('submittedAt', 'desc')));
  return snapshot.docs
    .map(entry => normalizeSubmission(entry.id, entry.data() as Partial<GovernmentSubmission>))
    .filter(submission => postMap.has(submission.postId))
    .map(submission => ({
      ...submission,
      post: postMap.get(submission.postId) || submission.post,
    }));
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: 'received' | 'processing' | 'resolved',
) {
  const submissionSnapshot = await getDoc(doc(submissionsCollection(), submissionId));
  if (!submissionSnapshot.exists()) {
    return;
  }

  const submission = normalizeSubmission(submissionSnapshot.id, submissionSnapshot.data() as Partial<GovernmentSubmission>);
  let updatedPost = submission.post;

  if (status === 'processing' && updatedPost.status !== 'resolved') {
    updatedPost = { ...updatedPost, status: 'in-progress' };
    await persistPost(updatedPost);
  }

  if (status === 'received' && updatedPost.status === 'in-progress') {
    updatedPost = { ...updatedPost, status: 'open' };
    await persistPost(updatedPost);
  }

  await persistSubmission({
    ...submission,
    status,
    post: updatedPost,
  });
}

export async function addComment(postId: string, userId: string, text: string): Promise<Comment> {
  const post = await getPostById(postId);
  if (!post) {
    throw new Error('Post not found');
  }

  const comment: Comment = {
    id: generateId('comment'),
    postId,
    userId,
    text: text.trim(),
    createdAt: getNowIso(),
  };

  post.comments = [...post.comments, comment];
  await persistPost(post);

  if (post.isReported) {
    await upsertSubmissionForPost(post);
  }

  return comment;
}

export async function deleteComment(postId: string, commentId: string, userId: string) {
  const post = await getPostById(postId);
  if (!post) {
    return;
  }

  const targetComment = post.comments.find(comment => comment.id === commentId);
  if (!targetComment || targetComment.userId !== userId) {
    return;
  }

  post.comments = post.comments.filter(comment => comment.id !== commentId);
  await persistPost(post);

  if (post.isReported) {
    await upsertSubmissionForPost(post);
  }
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const post = await getPostById(postId);
  if (!post) {
    return false;
  }

  const actingUser = await getUserById(userId);
  const canDeleteOwnPost = post.userId === userId;
  const isAdmin = actingUser?.role === 'admin';
  if (!canDeleteOwnPost && !isAdmin) {
    return false;
  }

  await deleteDoc(doc(postsCollection(), postId));

  // Post deletion is the source of truth. Linked cleanup is best-effort because
  // some Firestore projects still deny deletes on tokens/submissions.
  try {
    const tokenMatches = await getDocs(query(tokensCollection(), where('postId', '==', postId)));
    await Promise.all(tokenMatches.docs.map(match => deleteDoc(doc(tokensCollection(), match.id))));
  } catch {
    // Ignore cleanup permission issues; orphaned receipts are filtered out on read.
  }

  try {
    await deleteSubmissionByPostId(postId);
  } catch {
    // Ignore cleanup permission issues; orphaned submissions are filtered out on read.
  }

  return true;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const cached = readUserStatsCache(userId);

  try {
    const snapshot = await getDoc(doc(userStatsCollection(), userId));

    if (!snapshot.exists()) {
      const stats = normalizeUserStats(userId, cached || { userId });
      await persistUserStats(stats);
      return stats;
    }

    const normalized = normalizeUserStats(snapshot.id, snapshot.data() as Partial<UserStats>);
    saveUserStatsCache(userId, normalized);
    return normalized;
  } catch {
    if (cached) {
      return cached;
    }

    return normalizeUserStats(userId, { userId });
  }
}

export async function updateUserStats(userId: string, updates: Partial<UserStats>): Promise<UserStats> {
  const current = await getUserStats(userId);
  const next = normalizeUserStats(userId, {
    ...current,
    ...updates,
  });

  await persistUserStats(next);
  return next;
}

export function calculateLevel(points: number): number {
  if (points >= 1000) return 5;
  if (points >= 500) return 4;
  if (points >= 250) return 3;
  if (points >= 100) return 2;
  return 1;
}

export function getLevelName(level: number): string {
  const levels: Record<number, string> = {
    1: 'Newcomer',
    2: 'Active Citizen',
    3: 'Community Helper',
    4: 'Local Champion',
    5: 'Community Leader',
  };

  return levels[level] || 'Newcomer';
}

export async function getLeaderboard(limitCount: number = 10): Promise<Array<UserStats & { user: User | null }>> {
  const [statsSnapshot, authoritySnapshot] = await Promise.all([
    getDocs(userStatsCollection()),
    getDocs(query(usersCollection(), where('role', '==', 'authority'))),
  ]);

  const authorities = new Map(
    authoritySnapshot.docs.map(entry => {
      const user = normalizeUser(entry.id, entry.data() as Partial<User>);
      return [user.id, user] as const;
    }),
  );

  const entries = statsSnapshot.docs
    .map(entry => normalizeUserStats(entry.id, entry.data() as Partial<UserStats>))
    .filter(stats => authorities.has(stats.userId))
    .map(stats => ({
      ...stats,
      user: authorities.get(stats.userId) || null,
    }))
    .sort((first, second) => {
      const secondScore = (second.resolverPoints ?? 0) + (second.creditCoins ?? 0);
      const firstScore = (first.resolverPoints ?? 0) + (first.creditCoins ?? 0);
      return secondScore - firstScore;
    })
    .slice(0, limitCount);

  return entries;
}

export async function getUserTokens(userId: string): Promise<Token[]> {
  const posts = await getPosts();
  const livePostIds = new Set(posts.map(post => post.id));
  const snapshot = await getDocs(query(tokensCollection(), where('userId', '==', userId)));
  const tokens = snapshot.docs.map(entry => normalizeToken(entry.id, entry.data() as Partial<Token>));
  return sortByDateDesc(tokens.filter(token => livePostIds.has(token.postId)), token => token.issuedAt);
}

export async function getUserRewardRedemptions(userId: string): Promise<RewardRedemption[]> {
  const cached = readRewardRedemptionCache(userId);

  try {
    const snapshot = await getDocs(query(rewardRedemptionsCollection(), where('userId', '==', userId)));
    const remote = sortByDateDesc(
      snapshot.docs.map(entry => normalizeRewardRedemption(entry.id, entry.data() as Partial<RewardRedemption>)),
      redemption => redemption.redeemedAt,
    );
    const merged = mergeRewardRedemptions(remote, cached);
    saveRewardRedemptionCache(userId, merged);
    return merged;
  } catch {
    return cached;
  }
}

export async function getTokenById(tokenId: string): Promise<Token | null> {
  if (!tokenId) {
    return null;
  }

  const snapshot = await getDoc(doc(tokensCollection(), tokenId));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeToken(snapshot.id, snapshot.data() as Partial<Token>);
}

export async function resolvePost(
  postId: string,
  resolvedBy: string,
  resolutionPhoto: string,
  resolutionNotes?: string,
): Promise<{ post: Post; tokenEarned?: Token } | null> {
  const post = await getPostById(postId);
  if (!post) {
    return null;
  }

  const resolvedPost: Post = {
    ...post,
    status: 'resolved',
    isReported: true,
    submittedToGov: true,
    resolvedAt: getNowIso(),
    resolvedBy,
    ...(resolutionPhoto ? { resolutionPhoto } : {}),
    ...(resolutionNotes?.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
  };

  await persistPost(resolvedPost);

  const existingSubmission = await getSubmissionByPostId(postId);
  await persistSubmission({
    id: existingSubmission?.id || generateId('submission'),
    postId,
    post: resolvedPost,
    submittedAt: existingSubmission?.submittedAt || resolvedPost.submittedToGovAt || resolvedPost.reportedAt || getNowIso(),
    status: 'resolved',
  });

  const resolverStats = await ensureUserStats(resolvedBy);
  const previousResolverPoints = resolverStats.resolverPoints ?? 0;
  const nextResolverPoints = previousResolverPoints + 15;

  await persistUserStats({
    ...resolverStats,
    resolverPoints: nextResolverPoints,
    creditCoins: (resolverStats.creditCoins ?? 0) + 35,
    issuesResolved: (resolverStats.issuesResolved ?? 0) + 1,
  });

  let tokenEarned: Token | undefined;
  const previousMilestone = Math.floor(previousResolverPoints / 100);
  const nextMilestone = Math.floor(nextResolverPoints / 100);

  if (nextMilestone > previousMilestone) {
    tokenEarned = await issueToken(resolvedBy, resolvedPost.id, resolvedPost.title, resolvedPost.category);
  }

  return { post: resolvedPost, ...(tokenEarned ? { tokenEarned } : {}) };
}

export async function updateResolutionProof(
  postId: string,
  resolutionPhoto: string,
  resolutionNotes?: string,
): Promise<Post | null> {
  const post = await getPostById(postId);
  if (!post) {
    return null;
  }

  if (!resolutionPhoto) {
    throw new Error('A resolution proof photo is required.');
  }

  const updatedPost: Post = normalizePost(post.id, {
    ...post,
    resolutionPhoto,
    ...(resolutionNotes?.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
  });

  await persistPost(updatedPost);

  const existingSubmission = await getSubmissionByPostId(postId);
  if (existingSubmission) {
    await persistSubmission({
      ...existingSubmission,
      post: updatedPost,
    });
  }

  return updatedPost;
}

export async function redeemCoins(userId: string, cost: number) {
  const stats = await getUserStats(userId);

  if (stats.creditCoins < cost) {
    throw new Error('Not enough credit coins to redeem this reward.');
  }

  const nextStats = {
    ...stats,
    creditCoins: stats.creditCoins - cost,
    redeemedCoins: (stats.redeemedCoins ?? 0) + cost,
  };

  await persistUserStats(nextStats);
  return { previousStats: stats, nextStats };
}

export async function redeemReward(userId: string, reward: RewardOption) {
  const { previousStats, nextStats } = await redeemCoins(userId, reward.cost);
  const redemption: RewardRedemption = {
    id: generateId('reward'),
    userId,
    rewardId: reward.id,
    rewardTitle: reward.title,
    rewardDescription: reward.description,
    rewardKind: reward.rewardKind,
    providerName: reward.providerName,
    faceValue: reward.faceValue,
    rewardItems: reward.includes,
    cost: reward.cost,
    redeemedAt: getNowIso(),
    status: reward.fulfillmentType === 'instant' ? 'fulfilled' : 'processing',
    deliveryWindow: reward.deliveryWindow,
    deliveryNote: reward.fulfillmentNote,
    settlementChannel: reward.settlementChannel,
    transactionReference: generateTransactionReference(),
    walletBalanceBefore: previousStats.creditCoins,
    walletBalanceAfter: nextStats.creditCoins,
    couponCode: reward.rewardKind === 'gift-card' ? generateCouponCode() : undefined,
    couponPin: reward.rewardKind === 'gift-card' ? generateCouponPin() : undefined,
  };

  await persistRewardRedemption(redemption);
  return { stats: nextStats, redemption };
}

export function getPostPriority(post: Post) {
  return getComplaintPriority(post);
}

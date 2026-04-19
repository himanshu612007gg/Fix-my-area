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
  buildJurisdictionLabel,
  computePostScore,
  computeSLADeadline,
  formatLocationLabel,
  getComplaintPriority,
  getDepartmentForCategory,
  findDuplicates,
} from '@/lib/portal';

export const ADMIN_USERNAME = 'r@bbit';
export const ADMIN_PASSWORD = 'g@j@r@2007';
export const ADMIN_EMAIL = 'rbt.ctrl.2007@community-portal.local';

export type UserRole = 'citizen' | 'authority' | 'admin';
export type UserApprovalStatus = 'not-required' | 'pending' | 'approved' | 'rejected';
export type AuthMode = 'signin' | 'signup';
export type Category = 'Pothole' | 'Broken Streetlight' | 'Park Maintenance' | 'Locality Cleanliness';
export type ComplaintStatus = 'submitted' | 'assigned' | 'in-progress' | 'resolved';

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
  phone?: string;
  ward?: string;
  assignedWard?: string;
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

export interface StatusChange {
  status: ComplaintStatus;
  changedAt: string;
  changedBy: string;
  note?: string;
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
  status: ComplaintStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionPhoto?: string;
  resolutionNotes?: string;
  // New fields for municipality management
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  assignedAt?: string;
  slaDeadline?: string;
  slaBreached?: boolean;
  duplicateGroupId?: string;
  duplicateCount?: number;
  statusHistory?: StatusChange[];
  deleted?: boolean;
  // Legacy compat fields (kept for migration)
  likes?: number;
  dislikes?: number;
  userLikes?: string[];
  userDislikes?: string[];
}

export interface GovernmentSubmission {
  id: string;
  postId: string;
  post: Post;
  submittedAt: string;
  status: 'received' | 'processing' | 'resolved';
}

export interface UserStats {
  userId: string;
  postsCreated: number;
  upvotesReceived: number;
  issuesResolved: number;
  lastLoginDate: string;
  totalResolutionTimeHours: number;
  averageResolutionTimeHours: number;
}

export interface Notification {
  id: string;
  userId: string;
  postId: string;
  postTitle: string;
  message: string;
  type: 'status_change' | 'assignment' | 'sla_breach';
  read: boolean;
  createdAt: string;
}

export interface WorkerPerformance {
  workerId: string;
  workerName: string;
  totalAssigned: number;
  totalResolved: number;
  totalInProgress: number;
  averageResolutionHours: number;
  slaBreachCount: number;
}

export interface WardReport {
  ward: string;
  totalComplaints: number;
  resolved: number;
  pending: number;
  averageResolutionDays: number;
  categoryBreakdown: Record<Category, number>;
  slaBreachRate: number;
}

const CURRENT_USER_KEY = 'local_issues_current_user';
const COLLECTIONS = {
  users: 'users',
  posts: 'posts',
  submissions: 'governmentSubmissions',
  userStats: 'userStats',
  notifications: 'notifications',
} as const;

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

function notificationsCollection() {
  return collection(getDb(), COLLECTIONS.notifications);
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

/** Map legacy categories to new spec categories */
function migrateCategory(category: string): Category {
  const mapping: Record<string, Category> = {
    'Infrastructure': 'Pothole',
    'Roads': 'Pothole',
    'Electricity': 'Broken Streetlight',
    'Water': 'Locality Cleanliness',
    'Healthcare': 'Locality Cleanliness',
    'Education': 'Park Maintenance',
    'Other': 'Locality Cleanliness',
    'Pothole': 'Pothole',
    'Broken Streetlight': 'Broken Streetlight',
    'Park Maintenance': 'Park Maintenance',
    'Locality Cleanliness': 'Locality Cleanliness',
  };
  return mapping[category] || 'Locality Cleanliness';
}

/** Map legacy statuses to new 4-step flow */
function migrateStatus(status: string): ComplaintStatus {
  const mapping: Record<string, ComplaintStatus> = {
    'open': 'submitted',
    'submitted': 'submitted',
    'assigned': 'assigned',
    'in-progress': 'in-progress',
    'resolved': 'resolved',
  };
  return mapping[status] || 'submitted';
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
    ...(data.phone ? { phone: data.phone } : {}),
    ...(data.ward ? { ward: data.ward } : {}),
    ...(data.assignedWard ? { assignedWard: data.assignedWard } : {}),
  };
}

function normalizePost(id: string, data: Partial<Post>): Post {
  const category = migrateCategory(data.category || 'Locality Cleanliness');
  const status = migrateStatus(data.status || 'submitted');
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
  // Migrate from likes/dislikes to upvotes
  const upvotes = typeof data.upvotes === 'number'
    ? data.upvotes
    : typeof data.likes === 'number'
      ? data.likes
      : 0;
  const userUpvotes = Array.isArray(data.userUpvotes)
    ? data.userUpvotes.filter(Boolean)
    : Array.isArray(data.userLikes)
      ? data.userLikes.filter(Boolean)
      : [];
  const locationLabel = formatLocationLabel(locationDetails, data.location);
  const assignedDepartment = data.assignedDepartment || getDepartmentForCategory(category);
  const jurisdictionLabel = data.jurisdictionLabel || buildJurisdictionLabel(locationDetails, data.location);
  const referenceNumber = data.referenceNumber || `FMA-${id.slice(-8).toUpperCase()}`;
  const slaDeadline = data.slaDeadline || computeSLADeadline(data.createdAt || getNowIso(), category);

  return {
    id,
    userId: data.userId || '',
    title: data.title || '',
    description: data.description || '',
    category,
    ...(locationLabel ? { location: locationLabel } : {}),
    ...(locationDetails ? { locationDetails } : {}),
    photos: Array.isArray(data.photos) ? data.photos.filter(Boolean) : [],
    upvotes,
    userUpvotes,
    score: typeof data.score === 'number' ? data.score : computePostScore({ upvotes, createdAt: data.createdAt }),
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
    slaDeadline,
    slaBreached: data.slaBreached || false,
    ...(data.resolvedAt ? { resolvedAt: data.resolvedAt } : {}),
    ...(data.resolvedBy ? { resolvedBy: data.resolvedBy } : {}),
    ...(data.resolutionPhoto ? { resolutionPhoto: data.resolutionPhoto } : {}),
    ...(data.resolutionNotes ? { resolutionNotes: data.resolutionNotes } : {}),
    ...(data.assignedWorkerId ? { assignedWorkerId: data.assignedWorkerId } : {}),
    ...(data.assignedWorkerName ? { assignedWorkerName: data.assignedWorkerName } : {}),
    ...(data.assignedAt ? { assignedAt: data.assignedAt } : {}),
    ...(data.duplicateGroupId ? { duplicateGroupId: data.duplicateGroupId } : {}),
    duplicateCount: typeof data.duplicateCount === 'number' ? data.duplicateCount : 1,
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
    ...(data.deleted ? { deleted: true } : {}),
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
  return {
    userId,
    postsCreated: typeof data.postsCreated === 'number' ? data.postsCreated : 0,
    upvotesReceived: typeof data.upvotesReceived === 'number' ? data.upvotesReceived : 0,
    issuesResolved: typeof data.issuesResolved === 'number' ? data.issuesResolved : 0,
    lastLoginDate: data.lastLoginDate || getNowIso(),
    totalResolutionTimeHours: typeof data.totalResolutionTimeHours === 'number' ? data.totalResolutionTimeHours : 0,
    averageResolutionTimeHours: typeof data.averageResolutionTimeHours === 'number' ? data.averageResolutionTimeHours : 0,
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
  await setDoc(doc(userStatsCollection(), normalized.userId), normalized);
}

async function persistNotification(notification: Notification) {
  try {
    await setDoc(doc(notificationsCollection(), notification.id), notification);
  } catch {
    // Best effort — notifications are non-critical
  }
}

async function ensureUserStats(userId: string) {
  const existing = await getUserStats(userId);
  return existing;
}

/**
 * If a user's Firestore document ID doesn't match the Firebase Auth UID,
 * migrate the document to use the Firebase UID as the key.
 * This is critical because Firestore security rules check users/{request.auth.uid}
 * to verify roles (e.g. isAdmin).
 */
async function migrateUserDocumentId(existingUser: User, firebaseUid: string): Promise<User> {
  if (existingUser.id === firebaseUid) {
    return existingUser; // Already correct
  }

  const migratedUser: User = { ...existingUser, id: firebaseUid, firebaseUid };

  // Create the document under the correct Firebase UID key
  await setDoc(doc(usersCollection(), firebaseUid), migratedUser);

  // Delete the old document (best effort — may fail if rules block it,
  // but the new document is already in place so the app will work)
  try {
    await deleteDoc(doc(usersCollection(), existingUser.id));
  } catch {
    // Non-critical: old document may remain but the new one is canonical
  }

  // Migrate user stats to the new ID
  try {
    const oldStats = await getUserStats(existingUser.id);
    if (oldStats) {
      await persistUserStats({ ...oldStats, userId: firebaseUid });
    }
  } catch {
    // Non-critical
  }

  return migratedUser;
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

export async function initializeDB() {
  return;
}

export function isAuthorityApproved(user: User | null | undefined) {
  return user?.role === 'authority' && user.approvalStatus === 'approved';
}

/* ------------------------------------------------------------------ */
/*  Authentication                                                     */
/* ------------------------------------------------------------------ */

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
    throw new Error('This Google account belongs to a protected staff account. Use the worker sign-in section.');
  }

  if (mode === 'signup') {
    throw new Error('Account already exists. Please sign in instead.');
  }

  // Migrate document if stored under a different ID than Firebase UID
  const migrated = await migrateUserDocumentId(existingUser, profile.googleId);

  const updatedUser: User = normalizeUser(migrated.id, {
    ...migrated,
    email: normalizedEmail,
    name: migrated.name || normalizedName,
    firebaseUid: profile.googleId,
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl || migrated.avatarUrl,
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

export async function authenticateCitizenPassword(
  profile: FirebasePasswordProfile,
  mode: AuthMode,
): Promise<User> {
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
    throw new Error('This email belongs to a protected staff account. Use the worker sign-in section.');
  }

  if (mode === 'signup') {
    throw new Error('Citizen account already exists. Please sign in instead.');
  }

  // Migrate document if stored under a different ID than Firebase UID
  const migrated = await migrateUserDocumentId(existingUser, profile.uid);

  const updatedUser: User = normalizeUser(migrated.id, {
    ...migrated,
    email: normalizedEmail,
    name: migrated.name || normalizedName,
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

export async function authenticateAuthority(
  profile: FirebasePasswordProfile,
  mode: AuthMode,
  extraFields?: { phone?: string },
): Promise<User> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const normalizedName = profile.name.trim() || normalizedEmail.split('@')[0];
  const existingByUid = await getUserByFirebaseUid(profile.uid);
  const existingByEmail = existingByUid ? null : await getUserByEmail(normalizedEmail);
  const existingUser = existingByUid || existingByEmail;

  if (!existingUser) {
    if (mode === 'signin') {
      throw new Error('No worker account found. Please sign up first.');
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
      ...(extraFields?.phone ? { phone: extraFields.phone } : {}),
    };

    await persistUser(newUser);
    await persistUserStats(normalizeUserStats(newUser.id, { userId: newUser.id }));
    saveCurrentUser(newUser);
    return newUser;
  }

  if (existingUser.role !== 'authority') {
    throw new Error('This account is not registered as a municipality worker.');
  }

  if (mode === 'signup') {
    throw new Error('A worker account already exists. Please sign in instead.');
  }

  // Migrate document if stored under a different ID than Firebase UID
  const migrated = await migrateUserDocumentId(existingUser, profile.uid);

  const updatedUser = normalizeUser(migrated.id, {
    ...migrated,
    email: normalizedEmail,
    name: migrated.name || normalizedName,
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

  // Migrate document if stored under a different ID than Firebase UID
  const migrated = await migrateUserDocumentId(existingUser, profile.uid);

  const updatedUser = normalizeUser(migrated.id, {
    ...migrated,
    email: normalizedEmail,
    name: migrated.name || profile.name || ADMIN_USERNAME,
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

  // Migrate document if stored under a different ID than Firebase UID
  const migrated = await migrateUserDocumentId(user, firebaseUser.uid);

  const updatedUser = normalizeUser(migrated.id, {
    ...migrated,
    email: firebaseUser.email,
    firebaseUid: firebaseUser.uid,
    ...(migrated.authProvider === 'google' ? { googleId: firebaseUser.uid } : {}),
    avatarUrl: firebaseUser.photoURL || migrated.avatarUrl,
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

export async function getApprovedWorkers(): Promise<User[]> {
  return getAuthorityUsers('approved');
}

export async function getWorkersByWard(ward: string): Promise<User[]> {
  const workers = await getApprovedWorkers();
  return workers.filter(w => w.assignedWard === ward);
}

export async function updateAuthorityApproval(
  authorityUserId: string,
  status: Exclude<UserApprovalStatus, 'not-required'>,
  adminUserId: string,
): Promise<User> {
  const user = await getUserById(authorityUserId);

  if (!user) {
    throw new Error('Worker user not found.');
  }

  if (user.role !== 'authority') {
    throw new Error('Only worker accounts can be reviewed.');
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

export async function updateWorkerWard(workerId: string, ward: string): Promise<User> {
  const user = await getUserById(workerId);
  if (!user) throw new Error('Worker not found.');
  if (user.role !== 'authority') throw new Error('Only workers can be assigned wards.');

  const updated = normalizeUser(user.id, { ...user, assignedWard: ward });
  await persistUser(updated);
  return updated;
}

export async function removeWorker(workerId: string, adminUserId: string): Promise<boolean> {
  const worker = await getUserById(workerId);
  if (!worker) throw new Error('Worker not found.');
  if (worker.role !== 'authority') throw new Error('Only worker accounts can be removed.');

  // Verify the caller is actually an admin
  const firebaseUser = isFirebaseConfigured()
    ? await waitForFirebaseUser().catch(() => null)
    : null;
  const actingAdminId = firebaseUser?.uid || adminUserId;
  const admin = await getUserById(adminUserId) || await getUserById(actingAdminId) || await getUserByFirebaseUid(actingAdminId);
  if (!admin || admin.role !== 'admin') throw new Error('Only admins can remove workers.');
  const canonicalAdminId = firebaseUser?.uid || admin.firebaseUid || adminUserId || admin.id;

  // Firestore delete rules only trust admin records stored at /users/{request.auth.uid}.
  // Refresh that canonical record so legacy admin document IDs do not block worker removal.
  if (canonicalAdminId && admin.id !== canonicalAdminId) {
    await persistUser(normalizeUser(canonicalAdminId, {
      ...admin,
      firebaseUid: canonicalAdminId,
    }));
  }
  adminUserId = canonicalAdminId;

  // Unassign complaints that were assigned to this worker
  const posts = await getPosts();
  const assignedPosts = posts.filter(p => p.assignedWorkerId === workerId && p.status !== 'resolved');
  for (const post of assignedPosts) {
    const reverted: Post = {
      ...post,
      status: 'submitted',
      assignedWorkerId: undefined,
      assignedWorkerName: undefined,
      assignedAt: undefined,
      statusHistory: [
        ...(post.statusHistory || []),
        { status: 'submitted' as ComplaintStatus, changedAt: getNowIso(), changedBy: adminUserId, note: `Worker ${worker.name} removed — complaint unassigned` },
      ],
    };
    await persistPost(reverted);
  }

  // Delete the worker's user document
  await deleteDoc(doc(usersCollection(), workerId));

  // Best-effort cleanup of worker stats
  try {
    await deleteDoc(doc(userStatsCollection(), workerId));
  } catch {
    // Non-critical
  }

  return true;
}

/* ------------------------------------------------------------------ */
/*  Posts / Complaints                                                 */
/* ------------------------------------------------------------------ */

export async function getPosts(): Promise<Post[]> {
  const snapshot = await getDocs(query(postsCollection(), orderBy('createdAt', 'desc')));
  return snapshot.docs
    .map(entry => normalizePost(entry.id, entry.data() as Partial<Post>))
    .filter(post => !post.deleted);
}

export async function getPostById(id: string): Promise<Post | null> {
  if (!id) {
    return null;
  }

  const snapshot = await getDoc(doc(postsCollection(), id));
  if (!snapshot.exists()) {
    return null;
  }

  const post = normalizePost(snapshot.id, snapshot.data() as Partial<Post>);
  if (post.deleted) {
    return null;
  }

  return post;
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

export async function getPostsByWard(ward: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter(post => post.locationDetails?.ward === ward);
}

export async function getPostsAssignedToWorker(workerId: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter(post => post.assignedWorkerId === workerId);
}

export async function createPost(
  userId: string,
  title: string,
  description: string,
  category: Category,
  location?: string,
  photos: string[] = [],
  locationDetails?: ComplaintLocation,
): Promise<{ post: Post }> {
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
  const slaDeadline = computeSLADeadline(now, category);

  // Duplicate detection
  const existingPosts = await getPosts();
  const duplicateIds = findDuplicates(
    { title, category, locationDetails: normalizedLocationDetails },
    existingPosts,
  );
  const duplicateGroupId = duplicateIds.length > 0 ? (existingPosts.find(p => p.id === duplicateIds[0])?.duplicateGroupId || duplicateIds[0]) : undefined;

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
    score: computePostScore({ upvotes: 0, createdAt: now }),
    comments: [],
    createdAt: now,
    submittedToGov: true,
    submittedToGovAt: now,
    isReported: true,
    reportedAt: now,
    assignedDepartment: getDepartmentForCategory(category),
    assignedOffice: `${jurisdictionLabel} Administration`,
    jurisdictionLabel,
    referenceNumber: `FMA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    status: 'submitted',
    slaDeadline,
    slaBreached: false,
    duplicateCount: duplicateIds.length + 1,
    ...(duplicateGroupId ? { duplicateGroupId } : {}),
    statusHistory: [{ status: 'submitted', changedAt: now, changedBy: userId, note: 'Complaint filed by citizen' }],
  };

  await persistPost(post);
  await upsertSubmissionForPost(post);

  // Update duplicate counts for related posts
  if (duplicateIds.length > 0) {
    for (const dupId of duplicateIds) {
      const dupPost = await getPostById(dupId);
      if (dupPost) {
        dupPost.duplicateCount = (dupPost.duplicateCount || 1) + 1;
        if (!dupPost.duplicateGroupId) dupPost.duplicateGroupId = dupPost.id;
        await persistPost(dupPost);
      }
    }
  }

  const stats = await ensureUserStats(userId);
  await persistUserStats({
    ...stats,
    postsCreated: stats.postsCreated + 1,
  });

  return { post };
}

export async function upvotePost(postId: string, userId: string): Promise<Post> {
  const post = await getPostById(postId);

  if (!post) {
    throw new Error('Post not found');
  }

  const hasUpvoted = post.userUpvotes.includes(userId);

  if (hasUpvoted) {
    // Toggle off
    post.userUpvotes = post.userUpvotes.filter(id => id !== userId);
    post.upvotes = Math.max(0, post.upvotes - 1);
  } else {
    post.userUpvotes = [...post.userUpvotes, userId];
    post.upvotes += 1;

    // Award upvote to author
    const authorStats = await ensureUserStats(post.userId);
    await persistUserStats({
      ...authorStats,
      upvotesReceived: authorStats.upvotesReceived + 1,
    });
  }

  post.score = computePostScore(post);
  await persistPost(post);

  if (post.submittedToGov) {
    await upsertSubmissionForPost(post);
  }

  return post;
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

/* ------------------------------------------------------------------ */
/*  Complaint Assignment                                               */
/* ------------------------------------------------------------------ */

export async function assignComplaintToWorker(
  postId: string,
  workerId: string,
  adminUserId: string,
): Promise<Post> {
  const post = await getPostById(postId);
  if (!post) throw new Error('Complaint not found.');

  const worker = await getUserById(workerId);
  if (!worker) throw new Error('Worker not found.');
  if (worker.role !== 'authority' || worker.approvalStatus !== 'approved') {
    throw new Error('Worker is not approved.');
  }

  const now = getNowIso();
  const statusEntry: StatusChange = {
    status: 'assigned',
    changedAt: now,
    changedBy: adminUserId,
    note: `Assigned to ${worker.name}`,
  };

  const updatedPost: Post = {
    ...post,
    status: 'assigned',
    assignedWorkerId: workerId,
    assignedWorkerName: worker.name,
    assignedAt: now,
    statusHistory: [...(post.statusHistory || []), statusEntry],
  };

  await persistPost(updatedPost);
  await upsertSubmissionForPost(updatedPost, 'processing');

  // Notify citizen
  await createNotification(
    post.userId,
    postId,
    post.title,
    `Your complaint has been assigned to ${worker.name}`,
    'assignment',
  );

  return updatedPost;
}

export async function reassignComplaint(
  postId: string,
  newWorkerId: string,
  adminUserId: string,
): Promise<Post> {
  return assignComplaintToWorker(postId, newWorkerId, adminUserId);
}

/* ------------------------------------------------------------------ */
/*  Status Updates                                                     */
/* ------------------------------------------------------------------ */

export async function updateComplaintStatus(
  postId: string,
  newStatus: ComplaintStatus,
  changedBy: string,
  note?: string,
): Promise<Post> {
  const post = await getPostById(postId);
  if (!post) throw new Error('Complaint not found.');

  const now = getNowIso();
  const statusEntry: StatusChange = {
    status: newStatus,
    changedAt: now,
    changedBy,
    note: note || `Status changed to ${newStatus}`,
  };

  const updatedPost: Post = {
    ...post,
    status: newStatus,
    statusHistory: [...(post.statusHistory || []), statusEntry],
  };

  await persistPost(updatedPost);

  // Map to submission status
  const submissionStatus = newStatus === 'resolved'
    ? 'resolved' as const
    : (newStatus === 'in-progress' || newStatus === 'assigned')
      ? 'processing' as const
      : 'received' as const;

  const existingSubmission = await getSubmissionByPostId(postId);
  if (existingSubmission) {
    await persistSubmission({
      ...existingSubmission,
      status: submissionStatus,
      post: updatedPost,
    });
  }

  // Notify citizen about status change
  await createNotification(
    post.userId,
    postId,
    post.title,
    `Status updated to "${newStatus}"`,
    'status_change',
  );

  return updatedPost;
}

export async function resolvePost(
  postId: string,
  resolvedBy: string,
  resolutionPhoto: string,
  resolutionNotes?: string,
): Promise<{ post: Post } | null> {
  const post = await getPostById(postId);
  if (!post) {
    return null;
  }

  const now = getNowIso();
  const statusEntry: StatusChange = {
    status: 'resolved',
    changedAt: now,
    changedBy: resolvedBy,
    note: resolutionNotes || 'Resolved with photo proof',
  };

  const resolvedPost: Post = {
    ...post,
    status: 'resolved',
    isReported: true,
    submittedToGov: true,
    resolvedAt: now,
    resolvedBy,
    ...(resolutionPhoto ? { resolutionPhoto } : {}),
    ...(resolutionNotes?.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
    statusHistory: [...(post.statusHistory || []), statusEntry],
  };

  await persistPost(resolvedPost);

  const existingSubmission = await getSubmissionByPostId(postId);
  await persistSubmission({
    id: existingSubmission?.id || generateId('submission'),
    postId,
    post: resolvedPost,
    submittedAt: existingSubmission?.submittedAt || resolvedPost.submittedToGovAt || resolvedPost.reportedAt || now,
    status: 'resolved',
  });

  // Update worker stats
  const resolverStats = await ensureUserStats(resolvedBy);
  const createdTime = new Date(post.createdAt).getTime();
  const resolvedTime = new Date(now).getTime();
  const resolutionHours = (resolvedTime - createdTime) / (1000 * 60 * 60);
  const totalHours = resolverStats.totalResolutionTimeHours + resolutionHours;
  const totalResolved = resolverStats.issuesResolved + 1;

  await persistUserStats({
    ...resolverStats,
    issuesResolved: totalResolved,
    totalResolutionTimeHours: totalHours,
    averageResolutionTimeHours: totalHours / totalResolved,
  });

  // Notify citizen
  await createNotification(
    post.userId,
    postId,
    post.title,
    'Your complaint has been resolved! Check the resolution proof.',
    'status_change',
  );

  return { post: resolvedPost };
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

/* ------------------------------------------------------------------ */
/*  Comments                                                           */
/* ------------------------------------------------------------------ */

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

export async function deletePost(postId: string, userId: string, callerRole?: UserRole): Promise<boolean> {
  const post = await getPostById(postId);
  if (!post) {
    return false;
  }

  const firebaseUser = isFirebaseConfigured()
    ? await waitForFirebaseUser().catch(() => null)
    : null;
  const actingUserId = firebaseUser?.uid || userId;
  const canDeleteOwnPost = post.userId === userId || post.userId === actingUserId;
  // Trust the caller's role if provided (already authenticated), otherwise look it up
  let isAdmin = callerRole === 'admin';
  if (!isAdmin && !canDeleteOwnPost) {
    const actingUser = await getUserById(userId) || await getUserById(actingUserId);
    if (!actingUser) {
      // Fallback: try lookup by firebaseUid
      const byUid = await getUserByFirebaseUid(actingUserId) || await getUserByFirebaseUid(userId);
      isAdmin = byUid?.role === 'admin';
    } else {
      isAdmin = actingUser.role === 'admin';
    }
  }

  if (!canDeleteOwnPost && !isAdmin) {
    return false;
  }

  const submission = await getSubmissionByPostId(postId).catch(() => null);

  if (isAdmin) {
    try {
      await deleteDoc(doc(postsCollection(), postId));

      if (submission) {
        try {
          await deleteDoc(doc(submissionsCollection(), submission.id));
        } catch {
          const deletedPost: Post = { ...post, deleted: true };
          await persistSubmission({ ...submission, post: deletedPost });
        }
      }

      return true;
    } catch {
      // Fall back to soft-delete so admin cleanup still works when hard delete is blocked.
    }
  }

  // Soft-delete: mark the post as deleted via update (uses 'allow update' rule
  // which works for all signed-in users, unlike 'allow delete' which may be blocked)
  const deletedPost: Post = { ...post, deleted: true };
  await persistPost(deletedPost);

  if (submission) {
    try {
      await persistSubmission({ ...submission, post: deletedPost });
    } catch {
      // Non-critical
    }
  }

  return true;
}

/* ------------------------------------------------------------------ */
/*  User Stats                                                         */
/* ------------------------------------------------------------------ */

export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    const snapshot = await getDoc(doc(userStatsCollection(), userId));

    if (!snapshot.exists()) {
      const stats = normalizeUserStats(userId, { userId });
      await persistUserStats(stats);
      return stats;
    }

    return normalizeUserStats(snapshot.id, snapshot.data() as Partial<UserStats>);
  } catch {
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

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export async function createNotification(
  userId: string,
  postId: string,
  postTitle: string,
  message: string,
  type: Notification['type'],
): Promise<Notification> {
  const notification: Notification = {
    id: generateId('notif'),
    userId,
    postId,
    postTitle,
    message,
    type,
    read: false,
    createdAt: getNowIso(),
  };

  await persistNotification(notification);
  return notification;
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    const snapshot = await getDocs(
      query(notificationsCollection(), where('userId', '==', userId), orderBy('createdAt', 'desc')),
    );
    return snapshot.docs.map(entry => entry.data() as Notification);
  } catch {
    return [];
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const snapshot = await getDoc(doc(notificationsCollection(), notificationId));
    if (snapshot.exists()) {
      await setDoc(doc(notificationsCollection(), notificationId), {
        ...snapshot.data(),
        read: true,
      });
    }
  } catch {
    // Best effort
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const notifications = await getUserNotifications(userId);
  for (const n of notifications) {
    if (!n.read) {
      await markNotificationRead(n.id);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Worker Performance                                                 */
/* ------------------------------------------------------------------ */

export async function getWorkerPerformance(): Promise<WorkerPerformance[]> {
  const workers = await getApprovedWorkers();
  const allPosts = await getPosts();

  return Promise.all(workers.map(async worker => {
    const assigned = allPosts.filter(p => p.assignedWorkerId === worker.id);
    const resolved = assigned.filter(p => p.status === 'resolved');
    const inProgress = assigned.filter(p => p.status === 'in-progress');
    const breached = assigned.filter(p => p.slaBreached || (p.slaDeadline && new Date() > new Date(p.slaDeadline) && p.status !== 'resolved'));

    // Calculate average resolution time
    let totalResolutionHours = 0;
    resolved.forEach(p => {
      if (p.resolvedAt) {
        totalResolutionHours += (new Date(p.resolvedAt).getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
      }
    });

    return {
      workerId: worker.id,
      workerName: worker.name,
      totalAssigned: assigned.length,
      totalResolved: resolved.length,
      totalInProgress: inProgress.length,
      averageResolutionHours: resolved.length > 0 ? totalResolutionHours / resolved.length : 0,
      slaBreachCount: breached.length,
    };
  }));
}

/* ------------------------------------------------------------------ */
/*  SLA Monitoring                                                     */
/* ------------------------------------------------------------------ */

export async function getSLABreachedComplaints(): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter(p =>
    p.status !== 'resolved' &&
    p.slaDeadline &&
    new Date() > new Date(p.slaDeadline),
  );
}

/* ------------------------------------------------------------------ */
/*  Monthly Ward Reports                                               */
/* ------------------------------------------------------------------ */

export async function getMonthlyWardReport(year: number, month: number): Promise<WardReport[]> {
  const posts = await getPosts();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const monthPosts = posts.filter(p => {
    const d = new Date(p.createdAt);
    return d >= startOfMonth && d <= endOfMonth;
  });

  const wardMap = new Map<string, Post[]>();
  monthPosts.forEach(p => {
    const locationLabel = p.locationDetails?.pincode
      ? `PIN ${p.locationDetails.pincode}`
      : p.locationDetails?.locality?.trim()
        ? p.locationDetails.locality.trim()
        : p.jurisdictionLabel || 'Unknown Location';
    if (!wardMap.has(locationLabel)) wardMap.set(locationLabel, []);
    wardMap.get(locationLabel)!.push(p);
  });

  const reports: WardReport[] = [];
  wardMap.forEach((wardPosts, ward) => {
    const resolved = wardPosts.filter(p => p.status === 'resolved');
    const pending = wardPosts.filter(p => p.status !== 'resolved');
    const breached = wardPosts.filter(p =>
      p.slaDeadline && new Date() > new Date(p.slaDeadline) && p.status !== 'resolved',
    );

    let totalResolutionDays = 0;
    resolved.forEach(p => {
      if (p.resolvedAt) {
        totalResolutionDays += (new Date(p.resolvedAt).getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      }
    });

    const categoryBreakdown: Record<Category, number> = {
      'Pothole': 0,
      'Broken Streetlight': 0,
      'Park Maintenance': 0,
      'Locality Cleanliness': 0,
    };
    wardPosts.forEach(p => {
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + 1;
    });

    reports.push({
      ward,
      totalComplaints: wardPosts.length,
      resolved: resolved.length,
      pending: pending.length,
      averageResolutionDays: resolved.length > 0 ? Math.round(totalResolutionDays / resolved.length) : 0,
      categoryBreakdown,
      slaBreachRate: wardPosts.length > 0 ? Math.round((breached.length / wardPosts.length) * 100) : 0,
    });
  });

  return reports.sort((a, b) => b.totalComplaints - a.totalComplaints);
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */

export async function getCitizenLeaderboard(limitCount: number = 10): Promise<Array<UserStats & { user: User | null }>> {
  const [statsSnapshot, citizenSnapshot] = await Promise.all([
    getDocs(userStatsCollection()),
    getDocs(query(usersCollection(), where('role', '==', 'citizen'))),
  ]);

  const citizens = new Map(
    citizenSnapshot.docs.map(entry => {
      const user = normalizeUser(entry.id, entry.data() as Partial<User>);
      return [user.id, user] as const;
    }),
  );

  return statsSnapshot.docs
    .map(entry => normalizeUserStats(entry.id, entry.data() as Partial<UserStats>))
    .filter(stats => citizens.has(stats.userId))
    .map(stats => ({ ...stats, user: citizens.get(stats.userId) || null }))
    .sort((a, b) => (b.postsCreated + b.upvotesReceived) - (a.postsCreated + a.upvotesReceived))
    .slice(0, limitCount);
}

export async function getWorkerLeaderboard(limitCount: number = 10): Promise<Array<UserStats & { user: User | null }>> {
  const [statsSnapshot, workerSnapshot] = await Promise.all([
    getDocs(userStatsCollection()),
    getDocs(query(usersCollection(), where('role', '==', 'authority'))),
  ]);

  const workers = new Map(
    workerSnapshot.docs.map(entry => {
      const user = normalizeUser(entry.id, entry.data() as Partial<User>);
      return [user.id, user] as const;
    }),
  );

  return statsSnapshot.docs
    .map(entry => normalizeUserStats(entry.id, entry.data() as Partial<UserStats>))
    .filter(stats => workers.has(stats.userId))
    .map(stats => ({ ...stats, user: workers.get(stats.userId) || null }))
    .sort((a, b) => {
      if (b.issuesResolved !== a.issuesResolved) return b.issuesResolved - a.issuesResolved;
      return a.averageResolutionTimeHours - b.averageResolutionTimeHours;
    })
    .slice(0, limitCount);
}

export function getPostPriority(post: Post) {
  return getComplaintPriority(post);
}

'use client';

import {
  BadgeType,
  calculateLevel,
  getLeaderboard,
  getLevelName,
  getPosts,
  getResolvedPosts,
  getUserById,
  getUserStats,
  Post,
  resolvePost,
  updateUserStats,
  User,
  UserStats,
} from '@/lib/db';

export { calculateLevel, getLeaderboard, getLevelName, getResolvedPosts, getUserStats, resolvePost, updateUserStats };
export type { BadgeType, Post, User, UserStats };

export async function addPoints(userId: string, points: number) {
  const stats = await getUserStats(userId);
  return updateUserStats(userId, { points: stats.points + points });
}

export async function awardBadge(userId: string, badgeType: BadgeType) {
  const stats = await getUserStats(userId);

  if (stats.badges.includes(badgeType)) {
    return false;
  }

  await updateUserStats(userId, { badges: [...stats.badges, badgeType] });
  return true;
}

export async function checkAndAwardBadges(userId: string): Promise<BadgeType[]> {
  const [stats, allPosts, user] = await Promise.all([
    getUserStats(userId),
    getPosts(),
    getUserById(userId),
  ]);

  const posts = allPosts.filter(post => post.userId === userId);
  const newBadges: BadgeType[] = [];

  const categoryBadges: Record<string, BadgeType> = {
    Roads: 'pothole-patrol',
    Infrastructure: 'pothole-patrol',
    Water: 'water-warrior',
    Electricity: 'power-champion',
    Healthcare: 'health-hero',
  };

  for (const [category, badgeType] of Object.entries(categoryBadges)) {
    const categoryPosts = posts.filter(post => post.category === category);
    if (categoryPosts.length >= 5 && !stats.badges.includes(badgeType)) {
      const awarded = await awardBadge(userId, badgeType);
      if (awarded) {
        newBadges.push(badgeType);
      }
    }
  }

  if (stats.points >= 1000 && !stats.badges.includes('community-leader')) {
    const awarded = await awardBadge(userId, 'community-leader');
    if (awarded) {
      newBadges.push('community-leader');
    }
  }

  if (posts.filter(post => (post.likes ?? post.upvotes) >= 25).length >= 3 && !stats.badges.includes('rising-star')) {
    const awarded = await awardBadge(userId, 'rising-star');
    if (awarded) {
      newBadges.push('rising-star');
    }
  }

  const accountAge = Date.now() - new Date(user?.createdAt || 0).getTime();
  const daysActive = accountAge / (1000 * 60 * 60 * 24);
  if (daysActive >= 30 && posts.length >= 20 && !stats.badges.includes('veteran-reporter')) {
    const awarded = await awardBadge(userId, 'veteran-reporter');
    if (awarded) {
      newBadges.push('veteran-reporter');
    }
  }

  return newBadges;
}

export async function getOpenPosts(): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter(post => post.status === 'open');
}

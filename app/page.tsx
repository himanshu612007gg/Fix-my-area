'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getCurrentUser, initializeDB, isAuthorityApproved, logoutUser, User } from '@/lib/db';
import { signOutFirebaseUser } from '@/lib/firebase-auth';
import { isFirebaseConfigured } from '@/lib/firebase';

import AdminDashboard from '@/components/AdminDashboard';
import AuthPage from '@/components/AuthPage';
import GovernmentDashboard from '@/components/GovernmentDashboard';
import HomePage from '@/components/HomePage';
import Leaderboard from '@/components/Leaderboard';
import Navbar from '@/components/Navbar';
import ReportedPostsPage from '@/components/ReportedPostsPage';
import WallOfWins from '@/components/WallOfWins';

type PageView = 'home' | 'reported' | 'leaderboard' | 'wallofwins' | 'government' | 'auth' | 'admin';

export default function CommunityPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [pageView, setPageView] = useState<PageView>('auth');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setup = async () => {
      try {
        if (!isFirebaseConfigured()) {
          console.warn('Firebase is not configured. Please check environment variables.');
          setLoading(false);
          return;
        }

        await initializeDB();
        const currentUser = await getCurrentUser();

        if (currentUser) {
          setUser(currentUser);
          setPageView(getDefaultPage(currentUser));
        }
      } catch (error) {
        console.error('App initialization error', error);
      } finally {
        setLoading(false);
      }
    };

    void setup();
  }, []);

  const getDefaultPage = (targetUser: User): PageView => {
    if (targetUser.role === 'admin') return 'admin';
    if (targetUser.role === 'authority') return 'government';
    return 'home';
  };

  const handleAuthSuccess = async () => {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setPageView(getDefaultPage(currentUser));
    }
  };

  const handleLogout = async () => {
    logoutUser();
    setUser(null);
    setPageView('auth');

    try {
      await signOutFirebaseUser();
    } catch {
      // If Firebase sign-out fails, do nothing.
    }
  };

  if (loading) {
    return (
      <div className="portal-shell flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-medium">Loading Civic Issue Portal...</p>
      </div>
    );
  }

  if (!user || pageView === 'auth') {
    return (
      <div className="portal-shell">
        <AuthPage onAuthSuccess={() => void handleAuthSuccess()} />
      </div>
    );
  }

  // Worker pending approval gate
  if (user.role === 'authority' && !isAuthorityApproved(user)) {
    return (
      <div className="portal-shell flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-6 text-amber-800 dark:text-amber-200">
          <h2 className="text-2xl font-semibold">Pending admin approval</h2>
          <p className="mt-3 text-base leading-7 text-amber-700 dark:text-amber-300">
            Your municipality worker account has been registered successfully. An admin supervisor must approve your account before you can access the task dashboard.
          </p>
          <p className="mt-4 text-sm">
            Contact your supervisor or check back later. Once approved, you will see your complaint assignments.
          </p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-6 rounded-full border border-amber-500/30 bg-amber-500/5 px-6 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10 dark:text-amber-200"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <Navbar
        user={user}
        onLogout={() => void handleLogout()}
        pageView={pageView}
        onPageChange={setPageView}
      />

      <main>
        {pageView === 'home' && (
          <HomePage user={user} onPostsChange={() => {}} />
        )}
        {pageView === 'reported' && (
          <ReportedPostsPage user={user} onPostsChange={() => {}} />
        )}
        {pageView === 'leaderboard' && <Leaderboard />}
        {pageView === 'wallofwins' && <WallOfWins />}
        {pageView === 'government' && (
          <GovernmentDashboard user={user} />
        )}
        {pageView === 'admin' && (
          <AdminDashboard user={user} />
        )}
      </main>
    </div>
  );
}

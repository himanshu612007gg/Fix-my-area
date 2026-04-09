'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, initializeDB, logoutUser, User } from '@/lib/db';
import AuthPage from '@/components/AuthPage';
import HomePage from '@/components/HomePage';
import ReportedPostsPage from '@/components/ReportedPostsPage';
import GovernmentDashboard from '@/components/GovernmentDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import Leaderboard from '@/components/Leaderboard';
import WallOfWins from '@/components/WallOfWins';
import TokenWallet from '@/components/TokenWallet';
import Navbar from '@/components/Navbar';
import { signOutFirebaseUser } from '@/lib/firebase-auth';
import { Toaster } from 'sonner';
import { ShieldCheck } from 'lucide-react';

type PageView = 'home' | 'reported' | 'leaderboard' | 'wallofwins' | 'government' | 'auth' | 'tokens' | 'admin';

function getDefaultPageForUser(user: User | null): PageView {
  if (!user) {
    return 'home';
  }

  if (user.role === 'admin') {
    return 'admin';
  }

  if (user.role === 'authority') {
    return 'government';
  }

  return 'home';
}

function AuthorityPendingState({ user }: { user: User }) {
  const statusCopy = user.approvalStatus === 'rejected'
    ? {
        badge: 'Access rejected',
        title: 'Authority access is currently rejected.',
        description: 'An admin needs to review your account again before protected authority routes can be used.',
      }
    : {
        badge: 'Pending approval',
        title: 'Your authority account is waiting for admin approval.',
        description: 'You have signed in successfully, but protected authority routes stay locked until an admin validates your account.',
      };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-[2rem] border border-border bg-card p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            <ShieldCheck className="h-4 w-4" />
            {statusCopy.badge}
          </div>

          <h2 className="mt-6 text-3xl font-semibold text-foreground">{statusCopy.title}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{statusCopy.description}</p>

          <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-5">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Current review state: {user.approvalStatus}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pageView, setPageView] = useState<PageView>('home');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      await initializeDB();
      const user = await getCurrentUser();

      if (cancelled) {
        return;
      }

      setCurrentUser(user);
      setPageView(getDefaultPageForUser(user));
      setHydrated(true);
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const syncCurrentUser = async () => {
      const refreshedUser = await getCurrentUser();

      if (cancelled) {
        return;
      }

      setCurrentUser(refreshedUser);

      if (!refreshedUser) {
        setPageView('home');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncCurrentUser();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncCurrentUser();
    }, 30000);

    const handleWindowFocus = () => {
      void syncCurrentUser();
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [currentUser?.id]);

  if (!hydrated) return null;

  const handleLogout = () => {
    logoutUser();
    void signOutFirebaseUser().catch(() => undefined);
    setCurrentUser(null);
    setPageView('home');
  };

  const handleLogin = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    setPageView(getDefaultPageForUser(user));
  };

  const refreshPosts = () => undefined;

  const handlePageChange = (view: PageView) => {
    if (!currentUser) return;

    if (currentUser.role === 'citizen' && (view === 'government' || view === 'admin')) return;
    if (currentUser.role === 'authority' && (view === 'home' || view === 'reported' || view === 'admin')) return;
    if (currentUser.role === 'admin' && view !== 'admin') return;

    setPageView(view);
  };

  if (!currentUser) {
    return <AuthPage onAuthSuccess={handleLogin} />;
  }

  return (
    <div className="portal-shell min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <Navbar
        user={currentUser}
        onLogout={handleLogout}
        pageView={pageView}
        onPageChange={handlePageChange}
      />
      <main>
        {pageView === 'home' && currentUser.role === 'citizen' && (
          <HomePage user={currentUser} onPostsChange={refreshPosts} />
        )}
        {pageView === 'reported' && currentUser.role === 'citizen' && (
          <ReportedPostsPage user={currentUser} onPostsChange={refreshPosts} />
        )}

        {pageView === 'government' && currentUser.role === 'authority' && currentUser.approvalStatus === 'approved' && (
          <GovernmentDashboard />
        )}
        {pageView === 'government' && currentUser.role === 'authority' && currentUser.approvalStatus !== 'approved' && (
          <AuthorityPendingState user={currentUser} />
        )}
        {pageView === 'tokens' && currentUser.role !== 'admin' && (
          <TokenWallet user={currentUser} />
        )}
        {pageView === 'admin' && currentUser.role === 'admin' && (
          <AdminDashboard currentUser={currentUser} />
        )}

        {pageView === 'leaderboard' && <Leaderboard />}
        {pageView === 'wallofwins' && <WallOfWins />}
      </main>
    </div>
  );
}

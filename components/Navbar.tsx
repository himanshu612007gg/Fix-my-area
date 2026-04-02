'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  BadgeIndianRupee,
  Building2,
  Home,
  LogOut,
  Medal,
  Moon,
  ShieldCheck,
  Sun,
  Target,
  Wallet,
} from 'lucide-react';
import { User, getUserStats } from '@/lib/db';
import { Button } from '@/components/ui/button';

type PageView = 'home' | 'reported' | 'leaderboard' | 'wallofwins' | 'government' | 'auth' | 'tokens' | 'admin';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  pageView: PageView;
  onPageChange: (view: PageView) => void;
}

export default function Navbar({ user, onLogout, pageView, onPageChange }: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      const stats = await getUserStats(user.id);
      if (!cancelled) {
        setCoins(stats.creditCoins ?? 0);
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [pageView, user.id]);

  const navItems = user.role === 'admin'
    ? [{ view: 'admin', label: 'National Control Room', icon: <ShieldCheck className="h-4 w-4" /> }]
    : user.role === 'authority'
      ? [
          { view: 'government', label: 'Field Dashboard', icon: <Building2 className="h-4 w-4" /> },
          { view: 'leaderboard', label: 'Performance', icon: <Medal className="h-4 w-4" /> },
          { view: 'wallofwins', label: 'Resolved Works', icon: <Target className="h-4 w-4" /> },
          { view: 'tokens', label: 'Wallet', icon: <Wallet className="h-4 w-4" /> },
        ]
      : [
          { view: 'home', label: 'Citizen Dashboard', icon: <Home className="h-4 w-4" /> },
          { view: 'reported', label: 'Live Tracking', icon: <Target className="h-4 w-4" /> },
          { view: 'wallofwins', label: 'Success Stories', icon: <Medal className="h-4 w-4" /> },
          { view: 'tokens', label: 'Rewards Wallet', icon: <Wallet className="h-4 w-4" /> },
        ];

  const roleLabel = user.role === 'authority' ? 'Local Authority' : user.role === 'admin' ? 'National Admin' : 'Citizen Reporter';

  return (
    <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-[#ff9933] via-white to-[#138808] p-[1px] shadow-lg">
            <div className="flex h-full w-full items-center justify-center rounded-[1.2rem] bg-background">
              <BadgeIndianRupee className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">National Community Portal</p>
            <h1 className="portal-title text-2xl font-semibold text-foreground">Fix my area</h1>
            <p className="text-sm text-muted-foreground">{roleLabel}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 lg:items-end">
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
            {navItems.map(item => (
              <Button
                key={item.view}
                variant="ghost"
                onClick={() => onPageChange(item.view as PageView)}
                className={`rounded-full px-4 ${
                  pageView === item.view
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border/70 bg-card/70 hover:bg-muted'
                }`}
              >
                {item.icon}
                <span className="ml-2">{item.label}</span>
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {user.role !== 'admin' && (
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {coins} credit coins
              </div>
            )}
            <div className="rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-foreground">
              Signed in as {user.name}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full border border-border/70 bg-card/70"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full border border-border/70 bg-card/70 hover:text-destructive"
              onClick={onLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

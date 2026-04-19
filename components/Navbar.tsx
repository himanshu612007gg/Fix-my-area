'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  BadgeIndianRupee,
  Bell,
  Building2,
  Home,
  LogOut,
  Medal,
  Moon,
  ShieldCheck,
  Sun,
  Target,
} from 'lucide-react';
import { getUserNotifications, markAllNotificationsRead, Notification, User } from '@/lib/db';
import { Button } from '@/components/ui/button';

type PageView = 'home' | 'reported' | 'leaderboard' | 'wallofwins' | 'government' | 'auth' | 'admin';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  pageView: PageView;
  onPageChange: (view: PageView) => void;
}

export default function Navbar({ user, onLogout, pageView, onPageChange }: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      const notifs = await getUserNotifications(user.id);
      if (!cancelled) {
        setNotifications(notifs);
      }
    };

    void loadNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(() => void loadNotifications(), 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pageView, user.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const navItems = user.role === 'admin'
    ? [{ view: 'admin', label: 'Control Room', icon: <ShieldCheck className="h-4 w-4" /> }]
    : user.role === 'authority'
      ? [
          { view: 'government', label: 'Task Dashboard', icon: <Building2 className="h-4 w-4" /> },
          { view: 'leaderboard', label: 'Leaderboard', icon: <Medal className="h-4 w-4" /> },
          { view: 'wallofwins', label: 'Resolved', icon: <Target className="h-4 w-4" /> },
        ]
      : [
          { view: 'home', label: 'Dashboard', icon: <Home className="h-4 w-4" /> },
          { view: 'reported', label: 'Track Complaints', icon: <Target className="h-4 w-4" /> },
          { view: 'leaderboard', label: 'Leaderboard', icon: <Medal className="h-4 w-4" /> },
          { view: 'wallofwins', label: 'Success Stories', icon: <Target className="h-4 w-4" /> },
        ];

  const roleLabel = user.role === 'authority' ? 'Municipality Worker' : user.role === 'admin' ? 'Admin Supervisor' : 'Citizen Reporter';

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
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">Civic Issue Portal</p>
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
            {/* Notification bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full border border-border/70 bg-card/70"
                onClick={() => setShowNotifications(prev => !prev)}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border/70 bg-card shadow-2xl">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleMarkAllRead()}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 10).map(n => (
                        <div key={n.id} className={`border-b border-border/50 px-4 py-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                          <p className="text-sm font-medium text-foreground">{n.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{n.postTitle}</p>
                          <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-foreground">
              {user.name}
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

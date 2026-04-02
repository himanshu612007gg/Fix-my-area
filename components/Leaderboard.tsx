'use client';

import { useEffect, useState } from 'react';
import { Award, Medal, ShieldCheck, Star, Trophy } from 'lucide-react';
import { BADGE_DEFINITIONS, getCurrentUser, getLeaderboard, getLevelName, User, UserStats } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<Array<UserStats & { user: User | null }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      const [leaders, currentUser] = await Promise.all([
        getLeaderboard(10),
        getCurrentUser(),
      ]);

      if (!cancelled) {
        setLeaderboard(leaders);
        setCurrentUserId(currentUser?.id || null);
      }
    };

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-slate-400" />;
    if (rank === 3) return <Award className="h-6 w-6 text-orange-500" />;
    return <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-5xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Authority performance board
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Top performing public service teams</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Rankings combine resolution performance and reward earnings so citizens can see which authority teams are closing issues effectively.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-4">
          {leaderboard.length === 0 ? (
            <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85">
              <CardContent className="py-14 text-center">
                <Trophy className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-4 text-xl font-semibold text-foreground">No authority rankings available yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">Resolve complaints to populate the performance board.</p>
              </CardContent>
            </Card>
          ) : (
            leaderboard.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.userId === currentUserId;
              const totalScore = (entry.resolverPoints ?? 0) + (entry.creditCoins ?? 0);

              return (
                <Card
                  key={entry.userId}
                  className={`portal-card rounded-[1.75rem] border-border/70 bg-card/90 ${isCurrentUser ? 'border-primary/30' : ''}`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {getRankIcon(rank)}
                        </div>
                        <div>
                          <p className="text-xl font-semibold text-foreground">
                            {entry.user?.name || 'Authority team'}
                            {isCurrentUser && <span className="ml-2 text-sm text-primary">(You)</span>}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Level {entry.level} - {getLevelName(entry.level)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Combined score</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">{totalScore}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resolved</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">{entry.issuesResolved}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reward coins</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">{entry.creditCoins ?? 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 text-primary" />
                        Resolver points: {entry.resolverPoints ?? 0}
                      </div>
                      {entry.badges.slice(0, 4).map(badgeId => (
                        <span key={badgeId} className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-foreground">
                          {BADGE_DEFINITIONS[badgeId].icon} {BADGE_DEFINITIONS[badgeId].name}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

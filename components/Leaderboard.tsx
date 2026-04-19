'use client';

import { useEffect, useState } from 'react';
import { Award, Medal, ShieldCheck, Star, Trophy, TrendingUp, Users } from 'lucide-react';
import { getCitizenLeaderboard, getCurrentUser, getWorkerLeaderboard, User, UserStats } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type LeaderboardTab = 'citizens' | 'workers';

export default function Leaderboard() {
  const [tab, setTab] = useState<LeaderboardTab>('workers');
  const [citizenLeaderboard, setCitizenLeaderboard] = useState<Array<UserStats & { user: User | null }>>([]);
  const [workerLeaderboard, setWorkerLeaderboard] = useState<Array<UserStats & { user: User | null }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [citizens, workers, currentUser] = await Promise.all([
        getCitizenLeaderboard(10),
        getWorkerLeaderboard(10),
        getCurrentUser(),
      ]);

      if (!cancelled) {
        setCitizenLeaderboard(citizens);
        setWorkerLeaderboard(workers);
        setCurrentUserId(currentUser?.id || null);
      }
    };

    void load();

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

  const activeList = tab === 'citizens' ? citizenLeaderboard : workerLeaderboard;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-5xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Public leaderboard
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Top reporters and resolvers</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                See which citizens report the most impactful issues and which workers resolve them fastest. Rankings are based on activity and impact.
              </p>
            </div>
          </div>
        </section>

        {/* Tab toggle */}
        <div className="mt-6 flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setTab('workers')}
            className={`rounded-full border ${tab === 'workers' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Top Workers
          </Button>
          <Button
            variant="ghost"
            onClick={() => setTab('citizens')}
            className={`rounded-full border ${tab === 'citizens' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
          >
            <Users className="mr-2 h-4 w-4" />
            Top Citizens
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {activeList.length === 0 ? (
            <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85">
              <CardContent className="py-14 text-center">
                <Trophy className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-4 text-xl font-semibold text-foreground">No rankings yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tab === 'workers' ? 'Resolve complaints to appear on the leaderboard.' : 'File complaints to appear on the leaderboard.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            activeList.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.userId === currentUserId;

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
                            {entry.user?.name || (tab === 'workers' ? 'Municipality Worker' : 'Citizen')}
                            {isCurrentUser && <span className="ml-2 text-sm text-primary">(You)</span>}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        {tab === 'workers' ? (
                          <>
                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resolved</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{entry.issuesResolved}</p>
                            </div>
                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Avg time</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">
                                {entry.averageResolutionTimeHours > 0 ? `${Math.round(entry.averageResolutionTimeHours)}h` : '—'}
                              </p>
                            </div>
                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Score</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{entry.issuesResolved * 10}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reported</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{entry.postsCreated}</p>
                            </div>
                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Upvotes</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{entry.upvotesReceived}</p>
                            </div>
                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Impact</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">{entry.postsCreated + entry.upvotesReceived}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 text-primary" />
                      {tab === 'workers'
                        ? `Resolved ${entry.issuesResolved} complaints`
                        : `Filed ${entry.postsCreated} reports, received ${entry.upvotesReceived} upvotes`}
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, CircleAlert, Clock3, MapPinned, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCurrentUser,
  getGovernmentSubmissions,
  getPostPriority,
  getUserById,
  getUserStats,
  GovernmentSubmission,
  resolvePost,
  updateSubmissionStatus,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const statusLabels: Record<GovernmentSubmission['status'], string> = {
  received: 'Received',
  processing: 'Under Action',
  resolved: 'Resolved',
};

export default function GovernmentDashboard() {
  const [submissions, setSubmissions] = useState<GovernmentSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | GovernmentSubmission['status']>('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const [resolverCoins, setResolverCoins] = useState(0);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      const [allSubmissions, user] = await Promise.all([
        getGovernmentSubmissions(),
        getCurrentUser(),
      ]);

      const authorEntries = await Promise.all(
        [...new Set(allSubmissions.map(item => item.post.userId))].map(async userId => {
          const author = await getUserById(userId);
          return [userId, author?.name || 'Citizen reporter'] as const;
        }),
      );

      const stats = user ? await getUserStats(user.id) : null;

      if (!cancelled) {
        setSubmissions(allSubmissions);
        setCurrentUserId(user?.id || '');
        setAuthors(Object.fromEntries(authorEntries));
        setResolverCoins(stats?.creditCoins ?? 0);
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSubmissions = useMemo(() => {
    const visible = statusFilter === 'all'
      ? submissions
      : submissions.filter(submission => submission.status === statusFilter);

    return [...visible].sort((first, second) => {
      const priorityWeight = (submission: GovernmentSubmission) => {
        const priority = getPostPriority(submission.post);
        if (priority === 'urgent') return 3;
        if (priority === 'priority') return 2;
        if (priority === 'resolved') return 0;
        return 1;
      };

      return priorityWeight(second) - priorityWeight(first)
        || new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime();
    });
  }, [statusFilter, submissions]);

  const refreshStats = async () => {
    const [allSubmissions, stats] = await Promise.all([
      getGovernmentSubmissions(),
      currentUserId ? getUserStats(currentUserId) : Promise.resolve(null),
    ]);

    setSubmissions(allSubmissions);
    setResolverCoins(stats?.creditCoins ?? 0);
  };

  const handleStatusUpdate = async (submission: GovernmentSubmission, nextStatus: GovernmentSubmission['status']) => {
    if (nextStatus === 'resolved' && currentUserId) {
      const result = await resolvePost(submission.postId, currentUserId, '', 'Resolution marked through the field dashboard.');

      if (result) {
        toast.success('Complaint marked as resolved and reward coins issued.');
        await refreshStats();
      }

      return;
    }

    await updateSubmissionStatus(submission.id, nextStatus);
    toast.success(`Complaint moved to ${statusLabels[nextStatus]}.`);
    await refreshStats();
  };

  const stats = {
    total: submissions.length,
    received: submissions.filter(item => item.status === 'received').length,
    processing: submissions.filter(item => item.status === 'processing').length,
    resolved: submissions.filter(item => item.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-4 w-4" />
                Local administration dashboard
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Manage routed complaints with district and department clarity.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Use this desk to receive, act on, and close complaints that have already been routed from the public portal. Priorities are based on civic urgency and public feedback, not threshold voting.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Available reward coins</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{resolverCoins}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Cases under action</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{stats.processing}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total complaints</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Received</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.received}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Under action</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.processing}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{stats.resolved}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(['all', 'received', 'processing', 'resolved'] as const).map(status => (
            <Button
              key={status}
              variant="ghost"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border ${statusFilter === status ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
            >
              {status === 'all' ? 'All queues' : statusLabels[status as GovernmentSubmission['status']]}
            </Button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {filteredSubmissions.length === 0 ? (
            <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85">
              <CardContent className="py-14 text-center">
                <Clock3 className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-4 text-xl font-semibold text-foreground">No complaints in this queue.</p>
                <p className="mt-2 text-sm text-muted-foreground">New routed complaints will appear here automatically.</p>
              </CardContent>
            </Card>
          ) : (
            filteredSubmissions.map(submission => {
              const priority = getPostPriority(submission.post);

              return (
                <Card key={submission.id} className="portal-card rounded-[1.75rem] border-border/70 bg-card/90">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-2xl">{submission.post.title}</CardTitle>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>Filed by {authors[submission.post.userId] || 'Citizen reporter'}</span>
                        <span>{submission.post.referenceNumber}</span>
                        <span>{submission.post.assignedDepartment}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {statusLabels[submission.status]}
                      </span>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        {priority}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-6 lg:grid-cols-[1fr_240px]">
                    <div>
                      <p className="text-sm leading-7 text-foreground/85">{submission.post.description}</p>
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Jurisdiction</p>
                          <p className="mt-2 font-medium text-foreground">{submission.post.jurisdictionLabel}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Office</p>
                          <p className="mt-2 font-medium text-foreground">{submission.post.assignedOffice}</p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Public score</p>
                          <p className="mt-2 font-medium text-foreground">
                            {submission.post.likes} support / {submission.post.dislikes} concern
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button
                        className="w-full rounded-full"
                        disabled={submission.status === 'received'}
                        variant={submission.status === 'received' ? 'secondary' : 'outline'}
                        onClick={() => void handleStatusUpdate(submission, 'received')}
                      >
                        <CircleAlert className="mr-2 h-4 w-4" />
                        Mark received
                      </Button>
                      <Button
                        className="w-full rounded-full"
                        disabled={submission.status === 'processing'}
                        variant={submission.status === 'processing' ? 'secondary' : 'outline'}
                        onClick={() => void handleStatusUpdate(submission, 'processing')}
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Start action
                      </Button>
                      <Button
                        className="w-full rounded-full"
                        disabled={submission.status === 'resolved'}
                        onClick={() => void handleStatusUpdate(submission, 'resolved')}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark resolved
                      </Button>
                      <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPinned className="h-4 w-4 text-primary" />
                          Routed on {new Date(submission.submittedAt).toLocaleDateString('en-IN')}
                        </div>
                      </div>
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

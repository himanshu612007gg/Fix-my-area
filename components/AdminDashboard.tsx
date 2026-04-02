'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ShieldBan, ShieldCheck, Users, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAuthorityUsers,
  getGovernmentSubmissions,
  GovernmentSubmission,
  updateAuthorityApproval,
  User,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminDashboardProps {
  currentUser: User;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [authorities, setAuthorities] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<GovernmentSubmission[]>([]);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      const [authorityUsers, routedComplaints] = await Promise.all([
        getAuthorityUsers(),
        getGovernmentSubmissions(),
      ]);

      if (!cancelled) {
        setAuthorities(authorityUsers);
        setSubmissions(routedComplaints);
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingUsers = authorities.filter(user => user.approvalStatus === 'pending');
  const approvedUsers = authorities.filter(user => user.approvalStatus === 'approved');
  const rejectedUsers = authorities.filter(user => user.approvalStatus === 'rejected');

  const handleDecision = async (authorityUserId: string, status: 'approved' | 'rejected') => {
    setLoadingUserId(authorityUserId);

    try {
      const updated = await updateAuthorityApproval(authorityUserId, status, currentUser.id);
      setAuthorities(previous => previous.map(user => (user.id === authorityUserId ? updated : user)));
      toast.success(status === 'approved' ? 'Authority access approved.' : 'Authority access rejected.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update authority access.');
    } finally {
      setLoadingUserId(null);
    }
  };

  const resolvedComplaints = submissions.filter(item => item.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
                National control room
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Supervise authority access and portal-wide complaint flow.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                The admin desk now acts as the national operations console: approve field teams, monitor routed complaints, and keep the citizen-facing system accountable.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Approved authorities</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{approvedUsers.length}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Routed complaints</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{submissions.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4 text-amber-500" />
                Pending review
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{pendingUsers.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Active authorities
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{approvedUsers.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldBan className="h-4 w-4 text-rose-500" />
                Rejected access
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{rejectedUsers.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.5rem] border-border/70 bg-card/85">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Workflow className="h-4 w-4 text-primary" />
                Resolved complaints
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{resolvedComplaints}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle>Pending authority approvals</CardTitle>
              <CardDescription>Verify new field officers before they can access routed complaints and update statuses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingUsers.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">
                  No authority approvals are pending right now.
                </div>
              ) : (
                pendingUsers.map(user => (
                  <div key={user.id} className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Requested {new Date(user.createdAt).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => void handleDecision(user.id, 'approved')}
                          disabled={loadingUserId === user.id}
                          className="rounded-full"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => void handleDecision(user.id, 'rejected')}
                          disabled={loadingUserId === user.id}
                          variant="outline"
                          className="rounded-full"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Authority roster
              </CardTitle>
              <CardDescription>Complete visibility into approval states for the government side of the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {authorities.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">
                  No authority users have been created yet.
                </div>
              ) : (
                authorities.map(user => (
                  <div key={user.id} className="flex flex-col gap-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        user.approvalStatus === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : user.approvalStatus === 'rejected'
                            ? 'bg-rose-500/10 text-rose-600'
                            : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {user.approvalStatus}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.approvedBy && (
                      <p className="text-xs text-muted-foreground">Approved by {user.approvedBy}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

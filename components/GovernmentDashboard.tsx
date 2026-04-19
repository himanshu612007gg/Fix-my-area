'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ImageIcon,
  Loader2,
  MapPin,
  Play,
  Timer,
  TrendingUp,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPostsAssignedToWorker,
  resolvePost,
  updateComplaintStatus,
  getUserStats,
  Post,
  User,
  UserStats,
} from '@/lib/db';
import { formatSLARemaining, isSLABreached, CATEGORY_META } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GovernmentDashboardProps {
  user: User;
}

export default function GovernmentDashboard({ user }: GovernmentDashboardProps) {
  const [tasks, setTasks] = useState<Post[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionPhoto, setResolutionPhoto] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [assigned, userStats] = await Promise.all([
        getPostsAssignedToWorker(user.id),
        getUserStats(user.id),
      ]);
      setTasks(assigned);
      setStats(userStats);
    } catch {
      toast.error('Failed to load task dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [user.id]);

  const handleStartWork = async (postId: string) => {
    try {
      await updateComplaintStatus(postId, 'in-progress', user.id, 'Worker has started working on this issue');
      toast.success('Status updated to In Progress');
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status.');
    }
  };

  const handleResolvePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setResolutionPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleResolve = async (postId: string) => {
    if (!resolutionPhoto) {
      toast.error('Please upload an "after fix" photo as proof of resolution.');
      return;
    }

    try {
      await resolvePost(postId, user.id, resolutionPhoto, resolutionNotes);
      toast.success('Complaint resolved with photo proof!');
      setResolvingId(null);
      setResolutionPhoto('');
      setResolutionNotes('');
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Resolution failed.');
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'resolved');
  const resolvedTasks = tasks.filter(t => t.status === 'resolved');
  const slaBreachedTasks = activeTasks.filter(t => isSLABreached(t.slaDeadline, t.status));

  const avgResolutionDisplay = stats?.averageResolutionTimeHours
    ? `${Math.round(stats.averageResolutionTimeHours)}h`
    : '—';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ClipboardCheck className="h-4 w-4" />
                Worker task dashboard
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">
                Your assigned complaints
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Welcome, <strong>{user.name}</strong>. Review your assigned complaints, update progress, and upload "after fix" photo proof when resolved.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Active tasks</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{activeTasks.length}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{resolvedTasks.length}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Avg resolution time</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{avgResolutionDisplay}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">SLA breached</p>
                <p className={`mt-2 text-3xl font-semibold ${slaBreachedTasks.length > 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {slaBreachedTasks.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SLA Breach Alert */}
        {slaBreachedTasks.length > 0 && (
          <div className="mt-6 rounded-[1.5rem] border border-red-500/30 bg-red-500/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
                  {slaBreachedTasks.length} complaint(s) have breached their SLA deadline
                </p>
                <p className="mt-1 text-sm text-red-600/80 dark:text-red-300/70">
                  These require immediate attention. Overdue complaints affect your performance score.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Tasks */}
        <div className="mt-8">
          <h3 className="text-2xl font-semibold text-foreground">Active tasks</h3>
          <p className="mt-1 text-sm text-muted-foreground">Update status and resolve complaints assigned to you.</p>

          {activeTasks.length === 0 ? (
            <Card className="mt-5 rounded-[1.75rem] border-dashed border-border/70 bg-card/85">
              <CardContent className="py-14 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <p className="mt-4 text-xl font-semibold text-foreground">No active tasks</p>
                <p className="mt-2 text-sm text-muted-foreground">All your assigned complaints are resolved. Great work!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-5 space-y-4">
              {activeTasks.map(task => {
                const breached = isSLABreached(task.slaDeadline, task.status);
                const slaText = formatSLARemaining(task.slaDeadline, task.status);
                const categoryMeta = CATEGORY_META[task.category];
                const isResolving = resolvingId === task.id;

                return (
                  <Card key={task.id} className={`portal-card rounded-[1.75rem] border-border/70 bg-card/90 ${breached ? 'border-red-500/30' : ''}`}>
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="portal-chip border-primary/20 bg-primary/10 text-primary">
                              {categoryMeta?.icon} {task.category}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                              task.status === 'assigned'
                                ? 'border-sky-500/20 bg-sky-500/10 text-sky-600'
                                : 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                            }`}>
                              {task.status}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                              breached
                                ? 'border-red-500/30 bg-red-500/10 text-red-600'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                            }`}>
                              <Timer className="h-3 w-3" />
                              {slaText}
                            </span>
                          </div>

                          <h4 className="mt-3 text-xl font-semibold text-foreground">{task.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-foreground/80">{task.description}</p>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {task.jurisdictionLabel}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Filed {new Date(task.createdAt).toLocaleDateString('en-IN')}
                            </span>
                            <span>{task.referenceNumber}</span>
                          </div>

                          {/* Evidence photos */}
                          {task.photos.length > 0 && (
                            <div className="mt-4 flex gap-2 overflow-x-auto">
                              {task.photos.map((photo, i) => (
                                <img
                                  key={`${task.id}-photo-${i}`}
                                  src={photo}
                                  alt={`Evidence ${i + 1}`}
                                  className="h-20 w-20 shrink-0 rounded-xl border border-border/70 object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2">
                          {task.status === 'assigned' && (
                            <Button
                              onClick={() => void handleStartWork(task.id)}
                              className="rounded-full"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start work
                            </Button>
                          )}

                          {task.status === 'in-progress' && (
                            <Button
                              onClick={() => setResolvingId(isResolving ? null : task.id)}
                              variant={isResolving ? 'secondary' : 'default'}
                              className="rounded-full"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {isResolving ? 'Cancel' : 'Resolve with proof'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Resolution form */}
                      {isResolving && (
                        <div className="mt-5 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-5">
                          <h5 className="font-semibold text-foreground">Upload "After Fix" photo proof</h5>
                          <p className="mt-1 text-sm text-muted-foreground">
                            A resolution photo is required to mark this complaint as resolved.
                          </p>

                          <div className="mt-4 space-y-4">
                            <div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleResolvePhoto}
                              />
                              {resolutionPhoto ? (
                                <div className="relative inline-block">
                                  <img
                                    src={resolutionPhoto}
                                    alt="Resolution proof"
                                    className="h-40 w-auto rounded-xl border border-emerald-500/20 object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setResolutionPhoto('')}
                                    className="absolute -right-2 -top-2 rounded-full bg-background p-1 shadow"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="flex h-32 w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-emerald-500/30 text-sm text-muted-foreground transition hover:border-emerald-500/50 hover:text-foreground"
                                >
                                  <ImageIcon className="h-6 w-6" />
                                  Click to upload resolution photo
                                </button>
                              )}
                            </div>

                            <textarea
                              value={resolutionNotes}
                              onChange={event => setResolutionNotes(event.target.value)}
                              rows={3}
                              placeholder="Describe the work done (optional)"
                              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                            />

                            <Button
                              onClick={() => void handleResolve(task.id)}
                              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Submit resolution proof
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance profile */}
        <div className="mt-10">
          <h3 className="text-2xl font-semibold text-foreground">Your performance profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">Visible to the admin supervisor. Keep it up!</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-[1.5rem] border-border/70 bg-card/90">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total assigned</p>
                    <p className="text-2xl font-semibold text-foreground">{tasks.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-border/70 bg-card/90">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total resolved</p>
                    <p className="text-2xl font-semibold text-foreground">{stats?.issuesResolved || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-border/70 bg-card/90">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg resolution time</p>
                    <p className="text-2xl font-semibold text-foreground">{avgResolutionDisplay}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-border/70 bg-card/90">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${slaBreachedTasks.length > 0 ? 'bg-red-500/10 text-red-600' : 'bg-sky-500/10 text-sky-600'}`}>
                    <Timer className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SLA breaches</p>
                    <p className="text-2xl font-semibold text-foreground">{slaBreachedTasks.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Resolved history */}
        {resolvedTasks.length > 0 && (
          <div className="mt-10">
            <h3 className="text-2xl font-semibold text-foreground">Resolved history</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resolvedTasks.slice(0, 6).map(task => (
                <Card key={task.id} className="overflow-hidden rounded-[1.5rem] border-border/70 bg-card/90">
                  <CardContent className="p-0">
                    {task.resolutionPhoto ? (
                      <img src={task.resolutionPhoto} alt={task.title} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-emerald-500/5">
                        <ImageIcon className="h-8 w-8 text-emerald-600" />
                      </div>
                    )}
                    <div className="p-4">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                        Resolved
                      </span>
                      <h4 className="mt-2 font-semibold text-foreground">{task.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resolved on {new Date(task.resolvedAt || task.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, Clock3, ImagePlus, MapPinned, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCurrentUser,
  getGovernmentSubmissions,
  getPostPriority,
  getUserById,
  getUserStats,
  GovernmentSubmission,
  resolvePost,
  updateResolutionProof,
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
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);

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

  const handleResolutionPhotoUpload = (submissionId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file for the resolved-case proof.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Resolved-case proof photo must be 5MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setResolutionDrafts(previous => ({
        ...previous,
        [submissionId]: reader.result as string,
      }));
      toast.success('Resolved-case proof photo added.');
    };
    reader.readAsDataURL(file);
  };

  const clearResolutionDraft = (submissionId: string) => {
    setResolutionDrafts(previous => {
      const next = { ...previous };
      delete next[submissionId];
      return next;
    });
  };

  const getResolutionPreview = (submission: GovernmentSubmission) => {
    return resolutionDrafts[submission.id] || submission.post.resolutionPhoto || '';
  };

  const handleStatusUpdate = async (submission: GovernmentSubmission, nextStatus: GovernmentSubmission['status']) => {
    setUpdatingSubmissionId(submission.id);

    try {
      if (nextStatus === 'resolved') {
        if (!currentUserId) {
          throw new Error('Unable to verify the logged-in authority account for this resolution.');
        }

        const resolutionPhoto = getResolutionPreview(submission);

        if (!resolutionPhoto) {
          throw new Error('Upload a resolved-case photo before marking this complaint as resolved.');
        }

        const result = await resolvePost(
          submission.postId,
          currentUserId,
          resolutionPhoto,
          'Closed with on-site photo proof from the assigned authority.',
        );

        if (!result) {
          throw new Error('Unable to mark this complaint as resolved right now.');
        }

        clearResolutionDraft(submission.id);
        toast.success('Complaint marked as resolved and proof photo published.');
        await refreshStats();
        return;
      }

      await updateSubmissionStatus(submission.id, nextStatus);
      toast.success(`Complaint moved to ${statusLabels[nextStatus]}.`);
      await refreshStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update this complaint.');
    } finally {
      setUpdatingSubmissionId(null);
    }
  };

  const handleResolutionProofSave = async (submission: GovernmentSubmission) => {
    const resolutionPhoto = resolutionDrafts[submission.id];

    if (!resolutionPhoto) {
      toast.error('Upload a new proof photo before saving changes.');
      return;
    }

    setUpdatingSubmissionId(submission.id);

    try {
      const updatedPost = await updateResolutionProof(
        submission.postId,
        resolutionPhoto,
        submission.post.resolutionNotes || 'Closed with on-site photo proof from the assigned authority.',
      );

      if (!updatedPost) {
        throw new Error('Unable to save the updated proof photo right now.');
      }

      clearResolutionDraft(submission.id);
      toast.success('Resolved-case proof photo updated.');
      await refreshStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the resolved-case photo.');
    } finally {
      setUpdatingSubmissionId(null);
    }
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
              const resolutionPreview = getResolutionPreview(submission);
              const hasResolutionDraft = Boolean(resolutionDrafts[submission.id]);
              const isUpdating = updatingSubmissionId === submission.id;
              const isResolved = submission.status === 'resolved';
              const canStartAction = submission.status === 'received' && !isUpdating;
              const canResolve = !isResolved && Boolean(resolutionPreview) && Boolean(currentUserId) && !isUpdating;

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
                      {resolutionPreview ? (
                        <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-muted/20">
                          <img
                            src={resolutionPreview}
                            alt={`Resolved-case proof for ${submission.post.title}`}
                            className="h-40 w-full object-cover"
                          />
                          <div className="border-t border-border/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Resolution proof photo
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
                          Upload a final on-site photo before closing this complaint.
                        </div>
                      )}

                      <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {submission.status === 'resolved' ? 'Update proof photo' : 'Resolved-case proof'}
                        </p>
                        <input
                          id={`resolution-photo-${submission.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={event => handleResolutionPhotoUpload(submission.id, event)}
                        />
                        <label
                          htmlFor={`resolution-photo-${submission.id}`}
                          className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
                        >
                          <ImagePlus className="h-4 w-4 text-primary" />
                          {resolutionPreview ? 'Replace proof photo' : 'Upload proof photo'}
                        </label>
                        {hasResolutionDraft && (
                          <button
                            type="button"
                            onClick={() => clearResolutionDraft(submission.id)}
                            className="w-full rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                          >
                            Clear new photo
                          </button>
                        )}
                        {isResolved && hasResolutionDraft && (
                          <Button
                            className="w-full rounded-full"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => void handleResolutionProofSave(submission)}
                          >
                            {isUpdating ? 'Saving proof photo...' : 'Save proof photo'}
                          </Button>
                        )}
                        {isResolved && !hasResolutionDraft && (
                          <p className="text-sm text-muted-foreground">
                            Upload a replacement proof photo only if you need to update the existing closure photo.
                          </p>
                        )}
                        {!isResolved && (
                          <p className="text-sm text-muted-foreground">
                            {resolutionPreview
                              ? 'This proof photo will be published when you mark the complaint as resolved.'
                              : 'Upload a final proof photo to enable resolution.'}
                          </p>
                        )}
                      </div>

                      {!isResolved && (
                        <Button
                          className="w-full rounded-full"
                          disabled={!canStartAction}
                          variant={submission.status === 'processing' ? 'secondary' : 'outline'}
                          onClick={() => void handleStatusUpdate(submission, 'processing')}
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          {submission.status === 'processing' ? 'Action started' : 'Start action'}
                        </Button>
                      )}
                      {!isResolved && (
                        <Button
                          className="w-full rounded-full"
                          disabled={!canResolve}
                          onClick={() => void handleStatusUpdate(submission, 'resolved')}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {isUpdating ? 'Saving...' : 'Mark resolved'}
                        </Button>
                      )}
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

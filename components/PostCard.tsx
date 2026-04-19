'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ImageIcon,
  MessageSquare,
  Send,
  ShieldAlert,
  Timer,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { addComment, Comment, deleteComment, deletePost, getPostPriority, getUserById, Post, User, UserRole } from '@/lib/db';
import { formatSLARemaining, isSLABreached } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  currentUserRole?: UserRole;
  onUpvote: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const priorityTone: Record<string, string> = {
  critical: 'bg-red-600/10 text-red-600 border-red-500/20',
  urgent: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  priority: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  standard: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

const statusSteps: Array<{ key: string; label: string }> = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

function StatusStepper({ status }: { status: string }) {
  const currentIndex = statusSteps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-1">
      {statusSteps.map((step, i) => {
        const isActive = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] transition-all ${
              isCurrent
                ? 'bg-primary text-primary-foreground shadow-sm'
                : isActive
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted/40 text-muted-foreground'
            }`}>
              {isActive && i < currentIndex && <CheckCircle2 className="h-3 w-3" />}
              {step.label}
            </div>
            {i < statusSteps.length - 1 && (
              <div className={`h-0.5 w-3 rounded ${isActive ? 'bg-primary/40' : 'bg-muted/40'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PostCard({ post, currentUserId, currentUserRole, onUpvote, onDelete }: PostCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [comments, setComments] = useState<Comment[]>(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [author, setAuthor] = useState<User | null>(null);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, User | null>>({});

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.comments]);

  useEffect(() => {
    let cancelled = false;

    const loadAuthors = async () => {
      const uniqueIds = [...new Set([post.userId, ...comments.map(comment => comment.userId)])];
      const users = await Promise.all(uniqueIds.map(async userId => [userId, await getUserById(userId)] as const));

      if (!cancelled) {
        const nextMap = Object.fromEntries(users);
        setAuthor(nextMap[post.userId] || null);
        setCommentAuthors(nextMap);
      }
    };

    void loadAuthors();

    return () => {
      cancelled = true;
    };
  }, [comments, post.userId]);

  const hasUpvoted = post.userUpvotes.includes(currentUserId);
  const canDeletePost = currentUserRole === 'admin' || post.userId === currentUserId;
  const priority = getPostPriority(post);
  const resolutionProofPhoto = post.resolutionPhoto || '';
  const slaBreached = isSLABreached(post.slaDeadline, post.status);
  const issueLocationSummary = [post.locationDetails?.locality, post.locationDetails?.landmark]
    .filter(Boolean)
    .join(', ');
  const slaText = formatSLARemaining(post.slaDeadline, post.status);

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      return;
    }

    try {
      const newComment = await addComment(post.id, currentUserId, commentText);
      setComments(previous => [...previous, newComment]);
      setCommentText('');
    } catch {
      toast.error('Unable to add comment right now.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(post.id, commentId, currentUserId);
    setComments(previous => previous.filter(comment => comment.id !== commentId));
  };

  const handleDeletePost = async () => {
    const deleted = await deletePost(post.id, currentUserId, currentUserRole);
    if (!deleted) {
      toast.error('Complaint could not be deleted.');
      return;
    }

    toast.success('Complaint removed.');
    setShowDeleteConfirm(false);
    await onDelete?.();
  };

  return (
    <Card className="portal-card overflow-hidden rounded-[1.75rem] border-border/70 bg-card/90">
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="portal-chip border-primary/20 bg-primary/10 text-primary">{post.category}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${priorityTone[priority] || priorityTone.standard}`}>
                  {priority}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-foreground">{post.title}</h3>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>Filed by {author?.name || 'Anonymous citizen'}</span>
                <span>{new Date(post.createdAt).toLocaleDateString('en-IN')}</span>
                <span>{post.referenceNumber}</span>
              </div>
            </div>

            {canDeletePost && (
              <div>
                {showDeleteConfirm ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-[1rem] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <span className="font-medium">Delete this complaint permanently?</span>
                    <button
                      type="button"
                      onClick={() => void handleDeletePost()}
                      className="rounded-full bg-destructive px-3 py-1 font-semibold text-destructive-foreground"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-full border border-destructive/20 px-3 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                    aria-label="Delete complaint"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Status stepper */}
          <div className="mt-5">
            <StatusStepper status={post.status} />
          </div>

          {/* SLA indicator */}
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            slaBreached
              ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <Timer className="h-3.5 w-3.5" />
            {slaText}
          </div>

          {/* Duplicate indicator */}
          {post.duplicateCount && post.duplicateCount > 1 && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <UsersIcon className="h-3.5 w-3.5" />
              {post.duplicateCount} citizens reported this
            </div>
          )}

          {/* Assigned worker */}
          {post.assignedWorkerName && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Assigned to {post.assignedWorkerName}
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Jurisdiction</p>
              <p className="mt-2 font-medium text-foreground">{post.jurisdictionLabel}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Department</p>
              <p className="mt-2 font-medium text-foreground">{post.assignedDepartment}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">PIN code</p>
              <p className="mt-2 font-medium text-foreground">{post.locationDetails?.pincode || 'Not specified'}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Issue location</p>
              <p className="mt-2 font-medium text-foreground">{issueLocationSummary || 'Not specified'}</p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-foreground/85">{post.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => void onUpvote()}
              className={`rounded-full border px-4 ${hasUpvoted ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
            >
              <ChevronUp className="mr-1 h-4 w-4" />
              {post.upvotes} upvote{post.upvotes !== 1 ? 's' : ''}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowComments(previous => !previous)}
              className="rounded-full border border-border/70 bg-card/70 px-4"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {comments.length} comments
            </Button>
          </div>

          {showComments && (
            <div className="mt-6 rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
              <div className="flex gap-3">
                <input
                  value={commentText}
                  onChange={event => setCommentText(event.target.value)}
                  placeholder="Add a note or update"
                  className="flex-1 rounded-full border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
                />
                <Button onClick={() => void handleAddComment()} className="rounded-full">
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {comments.map(comment => {
                  const isCommentOwner = comment.userId === currentUserId;
                  return (
                    <div key={comment.id} className="rounded-[1.25rem] border border-border/60 bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{commentAuthors[comment.userId]?.name || 'User'}</p>
                          <p className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString('en-IN')}</p>
                        </div>
                        {isCommentOwner && (
                          <button type="button" onClick={() => void handleDeleteComment(comment.id)} className="text-muted-foreground transition hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground/80">{comment.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Before photo (evidence) */}
          {post.photos.length > 0 ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/20">
              <div className="relative">
                <img
                  src={post.photos[currentPhotoIndex]}
                  alt={`Evidence ${currentPhotoIndex + 1}`}
                  className="h-56 w-full object-cover"
                />
                {post.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPhotoIndex(previous => (previous - 1 + post.photos.length) % post.photos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPhotoIndex(previous => (previous + 1) % post.photos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">Before</span>
                <span>Photo {currentPhotoIndex + 1} of {post.photos.length}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/15 text-center">
              <ShieldAlert className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-foreground">No photo evidence</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Photos can help the team verify the issue faster.
              </p>
            </div>
          )}

          {/* After photo (resolution proof) - Before/After comparison */}
          {post.status === 'resolved' && (
            <div className="overflow-hidden rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5">
              {resolutionProofPhoto ? (
                <>
                  <img
                    src={resolutionProofPhoto}
                    alt={`Resolution proof for ${post.title}`}
                    className="h-56 w-full object-cover"
                  />
                  <div className="border-t border-emerald-500/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">After (Fixed)</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Resolved on {new Date(post.resolvedAt || post.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
                  <ImageIcon className="h-10 w-10 text-emerald-600" />
                  <p className="mt-4 text-sm font-semibold text-foreground">Resolution photo pending</p>
                </div>
              )}
            </div>
          )}

          {/* Status info */}
          <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
            <div className="flex items-center gap-3">
              {post.status === 'resolved' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <ClipboardCheck className="h-5 w-5 text-primary" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {post.status === 'resolved' ? 'Complaint resolved' : `Status: ${post.status}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {post.status === 'resolved'
                    ? `Closed on ${new Date(post.resolvedAt || post.createdAt).toLocaleDateString('en-IN')}`
                    : `Filed on ${new Date(post.submittedToGovAt || post.createdAt).toLocaleDateString('en-IN')}`}
                </p>
              </div>
            </div>
            {post.resolutionNotes && (
              <p className="mt-4 text-sm leading-6 text-foreground/80">{post.resolutionNotes}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

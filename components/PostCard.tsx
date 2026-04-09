'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ImageIcon,
  MessageSquare,
  Send,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { addComment, Comment, deleteComment, deletePost, getPostPriority, getUserById, Post, User } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLike: () => void | Promise<void>;
  onDislike: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const priorityTone: Record<string, string> = {
  urgent: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  priority: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  standard: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export default function PostCard({ post, currentUserId, onLike, onDislike, onDelete }: PostCardProps) {
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

  const hasLiked = post.userLikes.includes(currentUserId);
  const hasDisliked = post.userDislikes.includes(currentUserId);
  const isOwner = post.userId === currentUserId;
  const priority = getPostPriority(post);
  const resolutionProofPhoto = post.resolutionPhoto || '';

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
    const deleted = await deletePost(post.id, currentUserId);
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
                <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {post.status === 'in-progress' ? 'In progress' : post.status}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-foreground">{post.title}</h3>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span>Filed by {author?.name || 'Anonymous citizen'}</span>
                <span>{new Date(post.createdAt).toLocaleDateString('en-IN')}</span>
                <span>{post.referenceNumber}</span>
              </div>
            </div>

            {isOwner && (
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
                    <button type="button" onClick={() => setShowDeleteConfirm(false)} className="p-1">
                      <X className="h-4 w-4" />
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
                    <span>Delete complaint</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Jurisdiction</p>
              <p className="mt-2 font-medium text-foreground">{post.jurisdictionLabel}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Assigned department</p>
              <p className="mt-2 font-medium text-foreground">{post.assignedDepartment}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current office</p>
              <p className="mt-2 font-medium text-foreground">{post.assignedOffice}</p>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-foreground/85">{post.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => void onLike()}
              className={`rounded-full border px-4 ${hasLiked ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              {post.likes} support
            </Button>
            <Button
              variant="ghost"
              onClick={() => void onDislike()}
              className={`rounded-full border px-4 ${hasDisliked ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border/70 bg-card/70'}`}
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              {post.dislikes} concern
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
                  placeholder="Add a coordination note or citizen update"
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
                          <p className="font-medium text-foreground">{commentAuthors[comment.userId]?.name || 'Portal user'}</p>
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
          {post.photos.length > 0 ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/20">
              <div className="relative">
                <img
                  src={post.photos[currentPhotoIndex]}
                  alt={`Complaint evidence ${currentPhotoIndex + 1}`}
                  className="h-72 w-full object-cover"
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
                <span>Evidence {currentPhotoIndex + 1} of {post.photos.length}</span>
                <span>{post.location || post.jurisdictionLabel}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/15 text-center">
              <ShieldAlert className="h-10 w-10 text-primary" />
              <p className="mt-4 text-lg font-semibold text-foreground">Photo evidence pending</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                The complaint is already routed, but field verification images can still be added later.
              </p>
            </div>
          )}

          <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
            <div className="flex items-center gap-3">
              {post.status === 'resolved' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <ClipboardCheck className="h-5 w-5 text-primary" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {post.status === 'resolved' ? 'Complaint resolved' : 'Filed with administration'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {post.status === 'resolved'
                    ? `Closed on ${new Date(post.resolvedAt || post.createdAt).toLocaleDateString('en-IN')}`
                    : `Forwarded on ${new Date(post.submittedToGovAt || post.createdAt).toLocaleDateString('en-IN')}`}
                </p>
              </div>
            </div>
            {post.resolutionNotes && (
              <p className="mt-4 text-sm leading-6 text-foreground/80">{post.resolutionNotes}</p>
            )}
          </div>

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
                    <p className="text-sm font-semibold text-foreground">Resolution proof from the field team</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Uploaded on {new Date(post.resolvedAt || post.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-56 flex-col items-center justify-center px-6 text-center">
                  <ImageIcon className="h-10 w-10 text-emerald-600" />
                  <p className="mt-4 text-lg font-semibold text-foreground">Resolution photo pending</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The issue is marked resolved, and the field team can still upload the closure photo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

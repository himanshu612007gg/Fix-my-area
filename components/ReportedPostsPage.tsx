'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, ShieldCheck, TimerReset } from 'lucide-react';
import { Category, getReportedPosts, Post, upvotePost, User } from '@/lib/db';
import { COMPLAINT_CATEGORIES } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PostCard from '@/components/PostCard';

interface ReportedPostsPageProps {
  user: User;
  onPostsChange: () => void;
}

export default function ReportedPostsPage({ user, onPostsChange }: ReportedPostsPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'assigned' | 'in-progress' | 'resolved'>('all');

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      const trackedPosts = await getReportedPosts();
      if (!cancelled) {
        setPosts(trackedPosts);
      }
    };

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPosts = async () => {
    const trackedPosts = await getReportedPosts();
    setPosts(trackedPosts);
  };

  const visiblePosts = useMemo(() => {
    return posts
      .filter(post => (selectedCategory === 'All' ? true : post.category === selectedCategory))
      .filter(post => (statusFilter === 'all' ? true : post.status === statusFilter))
      .sort((first, second) => new Date(second.submittedToGovAt || second.createdAt).getTime() - new Date(first.submittedToGovAt || first.createdAt).getTime());
  }, [posts, selectedCategory, statusFilter]);

  const handleUpvote = async (postId: string) => {
    const updated = await upvotePost(postId, user.id);
    setPosts(previous => previous.map(post => (post.id === postId ? updated : post)));
    onPostsChange();
  };

  const submittedCount = posts.filter(post => post.status === 'submitted').length;
  const assignedCount = posts.filter(post => post.status === 'assigned').length;
  const inProgressCount = posts.filter(post => post.status === 'in-progress').length;
  const resolvedCount = posts.filter(post => post.status === 'resolved').length;

  const categories: Array<Category | 'All'> = ['All', ...COMPLAINT_CATEGORIES];

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Complaint tracking board
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Track your complaints through every stage.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Follow each complaint from Submitted → Assigned → In Progress → Resolved.
                See SLA deadlines, assigned workers, and resolution proof photos.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{submittedCount}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Assigned</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{assignedCount}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{inProgressCount}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{resolvedCount}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {(['all', 'submitted', 'assigned', 'in-progress', 'resolved'] as const).map(status => (
                <Button
                  key={status}
                  variant="ghost"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border ${statusFilter === status ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
                >
                  {status === 'all' ? 'All statuses' : status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map(category => (
                <Button
                  key={category}
                  variant="ghost"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full border ${selectedCategory === category ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
                >
                  {category}
                </Button>
              ))}
            </div>

            <div className="space-y-5">
              {visiblePosts.length === 0 ? (
                <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85">
                  <CardContent className="py-14 text-center">
                    <ClipboardList className="mx-auto h-10 w-10 text-primary" />
                    <p className="mt-4 text-xl font-semibold text-foreground">No complaints match this filter.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try a different category or status.</p>
                  </CardContent>
                </Card>
              ) : (
                visiblePosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user.id}
                    currentUserRole={user.role}
                    onUpvote={() => handleUpvote(post.id)}
                    onDelete={() => void refreshPosts()}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <MapPin className="h-5 w-5 text-primary" />
                  Status guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p><strong className="text-foreground">Submitted:</strong> Complaint received, pending admin review.</p>
                <p><strong className="text-foreground">Assigned:</strong> A municipality worker has been assigned.</p>
                <p><strong className="text-foreground">In Progress:</strong> Worker is actively working on it.</p>
                <p><strong className="text-foreground">Resolved:</strong> Issue fixed with photo proof.</p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TimerReset className="h-5 w-5 text-primary" />
                  Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Keep your complaint reference number for follow-ups.</p>
                <p>Upvote similar complaints to increase their priority.</p>
                <p>You'll see a notification when your complaint status changes.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

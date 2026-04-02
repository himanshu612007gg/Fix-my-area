'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, ShieldCheck, TimerReset } from 'lucide-react';
import { Category, getReportedPosts, Post, reactToPost, User } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PostCard from '@/components/PostCard';

interface ReportedPostsPageProps {
  user: User;
  onPostsChange: () => void;
}

const categories: Array<Category | 'All'> = ['All', 'Infrastructure', 'Education', 'Electricity', 'Water', 'Roads', 'Healthcare', 'Other'];

export default function ReportedPostsPage({ user, onPostsChange }: ReportedPostsPageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in-progress' | 'resolved'>('all');

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

  const handleReaction = async (postId: string, reaction: 'like' | 'dislike') => {
    const updated = await reactToPost(postId, user.id, reaction);
    setPosts(previous => previous.map(post => (post.id === postId ? updated : post)));
    onPostsChange();
  };

  const openCount = posts.filter(post => post.status === 'open').length;
  const inProgressCount = posts.filter(post => post.status === 'in-progress').length;
  const resolvedCount = posts.filter(post => post.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Administration tracking board
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Track complaints already routed to the district system.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                This live board shows which complaints have been received, which ones are under action, and which have already been resolved by the assigned office.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Open cases</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{openCount}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Under action</p>
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
              {(['all', 'open', 'in-progress', 'resolved'] as const).map(status => (
                <Button
                  key={status}
                  variant="ghost"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border ${statusFilter === status ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
                >
                  {status === 'all' ? 'All statuses' : status}
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
                    <p className="mt-4 text-xl font-semibold text-foreground">No complaints found for this filter.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try a different category or status to view district activity.</p>
                  </CardContent>
                </Card>
              ) : (
                visiblePosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user.id}
                    onLike={() => handleReaction(post.id, 'like')}
                    onDislike={() => handleReaction(post.id, 'dislike')}
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
                  Routing rule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Complaints are sent to the local office immediately after filing.</p>
                <p>District and locality indexing help the control room route them to the right department.</p>
                <p>Public support and concern signals help prioritize oversight, not eligibility.</p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TimerReset className="h-5 w-5 text-primary" />
                  Citizen guidance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Keep the receipt ID ready for district helpdesk calls or grievance camp visits.</p>
                <p>Use comments to add new evidence, escalation notes, or follow-up dates.</p>
                <p>Resolved complaints automatically move into the public success stories wall.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

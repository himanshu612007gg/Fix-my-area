'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, FileStack, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Category, getRegularPosts, getUserStats, Post, upvotePost, User } from '@/lib/db';
import { COMPLAINT_CATEGORIES } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreatePostForm from '@/components/CreatePostForm';
import PostCard from '@/components/PostCard';

interface HomePageProps {
  user: User;
  onPostsChange: () => void;
}

export default function HomePage({ user, onPostsChange }: HomePageProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [sortBy, setSortBy] = useState<'top' | 'newest' | 'urgent'>('top');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      const [nextPosts, stats] = await Promise.all([
        getRegularPosts(),
        getUserStats(user.id),
      ]);

      if (!cancelled) {
        setPosts(nextPosts);
        setSubmittedCount(stats.postsCreated);
      }
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const filteredPosts = useMemo(() => {
    const categoryMatched = selectedCategory === 'All'
      ? posts
      : posts.filter(post => post.category === selectedCategory);

    return [...categoryMatched].sort((first, second) => {
      if (sortBy === 'newest') {
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      }

      if (sortBy === 'urgent') {
        const statusWeight = (post: Post) => {
          if (post.category === 'Broken Streetlight') return 4;
          if (post.category === 'Pothole') return 3;
          if (post.category === 'Locality Cleanliness') return 2;
          return 1;
        };

        return statusWeight(second) - statusWeight(first) || second.upvotes - first.upvotes;
      }

      return second.score - first.score || second.upvotes - first.upvotes;
    });
  }, [posts, selectedCategory, sortBy]);

  const refreshDashboard = async () => {
    const [nextPosts, stats] = await Promise.all([
      getRegularPosts(),
      getUserStats(user.id),
    ]);

    setPosts(nextPosts);
    setSubmittedCount(stats.postsCreated);
  };

  const handlePostCreated = async () => {
    await refreshDashboard();
    setShowCreateForm(false);
    onPostsChange();
    toast.success('Complaint filed successfully!', {
      description: 'Your complaint has been submitted with Jalandhar location details for admin assignment.',
      duration: 7000,
    });
  };

  const handleUpvote = async (postId: string) => {
    const updatedPost = await upvotePost(postId, user.id);
    setPosts(previous => previous.map(post => (post.id === postId ? updatedPost : post)));
    onPostsChange();
  };

  const activeCases = posts.filter(post => post.status !== 'resolved').length;
  const resolvedCases = posts.filter(post => post.status === 'resolved').length;

  const categories: Array<Category | 'All'> = ['All', ...COMPLAINT_CATEGORIES];

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in overflow-hidden rounded-[2rem] border border-border/70 bg-card/85">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Civic issue reporting desk
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground lg:text-5xl">
                Report civic issues for your area and track their resolution.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                File complaints about potholes, broken streetlights, park maintenance, or cleanliness issues.
                Each complaint includes Jalandhar district, PIN code, and exact spot details so admins can assign the right worker quickly.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => setShowCreateForm(true)} className="rounded-full px-6">
                  <Plus className="mr-2 h-4 w-4" />
                  File a complaint
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <FileStack className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your complaints</p>
                    <p className="text-3xl font-semibold text-foreground">{submittedCount}</p>
                  </div>
                </div>
              </div>
              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-600">
                    <BellRing className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active cases</p>
                    <p className="text-3xl font-semibold text-foreground">{activeCases}</p>
                  </div>
                </div>
              </div>
              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                    <p className="text-3xl font-semibold text-foreground">{resolvedCases}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-border/70 bg-card p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="portal-chip border-primary/20 bg-primary/10 text-primary">Complaint form</p>
                  <h3 className="portal-title mt-4 text-3xl font-semibold text-foreground">File a civic complaint</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Select the issue type, enter the Jalandhar PIN code and exact location, and upload photo evidence for faster assignment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-full border border-border/70 p-2 text-muted-foreground transition hover:text-foreground"
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </button>
              </div>
              <CreatePostForm userId={user.id} onPostCreated={handlePostCreated} />
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-foreground">Complaints feed</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse civic issues, upvote urgent ones, and track resolution status.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['top', 'newest', 'urgent'] as const).map(option => (
                  <Button
                    key={option}
                    variant="ghost"
                    onClick={() => setSortBy(option)}
                    className={`rounded-full border ${sortBy === option ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
                  >
                    {option === 'top' ? 'Most Upvoted' : option === 'newest' ? 'Newest' : 'Most Urgent'}
                  </Button>
                ))}
              </div>
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
              {filteredPosts.length === 0 ? (
                <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85">
                  <CardContent className="py-14 text-center">
                    <Sparkles className="mx-auto h-10 w-10 text-primary" />
                    <p className="mt-4 text-xl font-semibold text-foreground">No complaints match this view.</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try a broader filter or file the first complaint.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user.id}
                    currentUserRole={user.role}
                    onUpvote={() => handleUpvote(post.id)}
                    onDelete={() => void refreshDashboard()}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="text-xl">SLA Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <div className="flex items-center justify-between"><span>🕳️ Pothole</span><span className="font-semibold text-foreground">7 days</span></div>
                <div className="flex items-center justify-between"><span>💡 Broken Streetlight</span><span className="font-semibold text-foreground">48 hours</span></div>
                <div className="flex items-center justify-between"><span>🌳 Park Maintenance</span><span className="font-semibold text-foreground">5 days</span></div>
                <div className="flex items-center justify-between"><span>🧹 Locality Cleanliness</span><span className="font-semibold text-foreground">3 days</span></div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="text-xl">How it works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>📋 File a complaint with photos, Jalandhar PIN code, and exact issue location.</p>
                <p>🔄 Admin reviews the complaint details and assigns the right municipality worker.</p>
                <p>🔨 Worker updates status as work progresses.</p>
                <p>📸 Worker uploads "after fix" photo as resolution proof.</p>
                <p>⬆️ Upvote complaints to show urgency to the municipality.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

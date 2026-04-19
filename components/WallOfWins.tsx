'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImageIcon, MapPin, PartyPopper } from 'lucide-react';
import { Category, getResolvedPosts, Post } from '@/lib/db';
import { COMPLAINT_CATEGORIES } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function WallOfWins() {
  const [resolvedPosts, setResolvedPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      const posts = await getResolvedPosts();
      if (!cancelled) {
        setResolvedPosts(posts);
      }
    };

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePosts = useMemo(() => {
    return resolvedPosts
      .filter(post => (selectedCategory === 'All' ? true : post.category === selectedCategory))
      .sort((first, second) => new Date(second.resolvedAt || 0).getTime() - new Date(first.resolvedAt || 0).getTime());
  }, [resolvedPosts, selectedCategory]);

  const getDaysToResolve = (post: Post) => {
    if (!post.resolvedAt) {
      return 0;
    }

    return Math.max(1, Math.ceil((new Date(post.resolvedAt).getTime() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
  };

  const categories: Array<Category | 'All'> = ['All', ...COMPLAINT_CATEGORIES];

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <PartyPopper className="h-4 w-4" />
                Success stories
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">Before & after — civic outcomes that matter.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Browse resolved complaints with before and after photo evidence. Every card is a real civic improvement.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Total resolved</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{resolvedPosts.length}</p>
              </div>
              <div className="portal-stat">
                <p className="text-sm text-muted-foreground">Average closure time</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {resolvedPosts.length > 0
                    ? Math.round(resolvedPosts.reduce((sum, post) => sum + getDaysToResolve(post), 0) / resolvedPosts.length)
                    : 0}{' '}
                  days
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
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

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiblePosts.length === 0 ? (
            <Card className="rounded-[1.75rem] border-dashed border-border/70 bg-card/85 md:col-span-2 xl:col-span-3">
              <CardContent className="py-14 text-center">
                <PartyPopper className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-4 text-xl font-semibold text-foreground">No resolved complaints for this category yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">Resolved cases will appear here with photo evidence.</p>
              </CardContent>
            </Card>
          ) : (
            visiblePosts.map(post => (
              <Card key={post.id} className="portal-card overflow-hidden rounded-[1.75rem] border-border/70 bg-card/90">
                <CardContent className="p-0">
                  {/* Before / After comparison */}
                  <div className="grid grid-cols-2">
                    {post.photos.length > 0 ? (
                      <div className="relative">
                        <img src={post.photos[0]} alt="Before" className="h-44 w-full object-cover" />
                        <span className="absolute bottom-2 left-2 rounded-full bg-red-600/80 px-2.5 py-0.5 text-xs font-semibold text-white">Before</span>
                      </div>
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-muted/20">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {post.resolutionPhoto ? (
                      <div className="relative">
                        <img src={post.resolutionPhoto} alt="After" className="h-44 w-full object-cover" />
                        <span className="absolute bottom-2 left-2 rounded-full bg-emerald-600/80 px-2.5 py-0.5 text-xs font-semibold text-white">After</span>
                      </div>
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-emerald-500/5">
                        <ImageIcon className="h-8 w-8 text-emerald-600" />
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                        Resolved
                      </span>
                      <span className="text-xs text-muted-foreground">{post.category}</span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">{post.title}</h3>
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {post.jurisdictionLabel}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-foreground/80">
                      {post.resolutionNotes || 'Resolved by the municipality team.'}
                    </p>
                    <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Closed in {getDaysToResolve(post)} days
                      </span>
                      <span>{new Date(post.resolvedAt || post.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

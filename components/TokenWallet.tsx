'use client';

import { useEffect, useState } from 'react';
import { Coins, Copy, Gift, ReceiptText, ShieldCheck, Ticket, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { redeemCoins, getUserStats, getUserTokens, Token, User, UserStats } from '@/lib/db';
import { getRewardOptionsForRole } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TokenWalletProps {
  user: User;
}

function RewardCard({
  title,
  description,
  cost,
  disabled,
  onRedeem,
}: {
  title: string;
  description: string;
  cost: number;
  disabled: boolean;
  onRedeem: () => void | Promise<void>;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{cost} coins</div>
      </div>
      <Button
        className="mt-4 w-full rounded-xl"
        disabled={disabled}
        onClick={() => void onRedeem()}
      >
        Redeem Reward
      </Button>
    </div>
  );
}

function ReceiptCard({ token }: { token: Token }) {
  const copyReceipt = async () => {
    await navigator.clipboard.writeText(token.id);
    toast.success('Receipt ID copied.');
  };

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-background/75 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{token.postTitle}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{token.category}</p>
          <p className="mt-3 font-mono text-sm font-semibold text-primary">{token.id}</p>
        </div>
        <button
          type="button"
          onClick={() => void copyReceipt()}
          className="rounded-xl border border-border p-2 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          aria-label="Copy receipt"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{new Date(token.issuedAt).toLocaleString('en-IN')}</span>
        <span className={token.status === 'redeemed' ? 'text-emerald-600' : 'text-amber-600'}>
          {token.status === 'redeemed' ? 'Archived' : 'Active receipt'}
        </span>
      </div>
    </div>
  );
}

export default function TokenWallet({ user }: TokenWalletProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [busyRewardId, setBusyRewardId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      const [nextStats, nextTokens] = await Promise.all([
        getUserStats(user.id),
        getUserTokens(user.id),
      ]);

      if (!cancelled) {
        setStats(nextStats);
        setTokens(nextTokens);
      }
    };

    void loadWallet();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const rewards = getRewardOptionsForRole(user.role);
  const coins = stats?.creditCoins ?? 0;

  const handleRedeem = async (rewardId: string, cost: number, title: string) => {
    setBusyRewardId(rewardId);

    try {
      const nextStats = await redeemCoins(user.id, cost);
      setStats(nextStats);
      toast.success(`${title} redeemed successfully.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to redeem reward.');
    } finally {
      setBusyRewardId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-6xl px-4">
        <section className="portal-card animate-rise-in overflow-hidden rounded-[2rem] border border-border/70 bg-card/85">
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
                Civic rewards wallet
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">
                Credit coins, complaint receipts, and service rewards in one place.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Citizens earn credit coins for verified complaints. Authorities earn the same for closing cases on time.
                Redeem coins for civic rewards while keeping receipt IDs ready for follow-up.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available credit coins</p>
                    <p className="text-3xl font-semibold text-foreground">{coins}</p>
                  </div>
                </div>
              </div>
              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                    {user.role === 'authority' ? <ShieldCheck className="h-6 w-6" /> : <ReceiptText className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{user.role === 'authority' ? 'Cases resolved' : 'Complaints filed'}</p>
                    <p className="text-3xl font-semibold text-foreground">
                      {user.role === 'authority' ? stats?.issuesResolved ?? 0 : stats?.postsCreated ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Gift className="h-5 w-5 text-primary" />
                Redemption catalogue
              </CardTitle>
              <CardDescription>
                Available reward options for {user.role === 'authority' ? 'field authorities' : user.role === 'citizen' ? 'citizen reporters' : 'operations users'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {rewards.map(reward => (
                <RewardCard
                  key={reward.id}
                  title={reward.title}
                  description={reward.description}
                  cost={reward.cost}
                  disabled={coins < reward.cost || busyRewardId === reward.id}
                  onRedeem={() => handleRedeem(reward.id, reward.cost, reward.title)}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Ticket className="h-5 w-5 text-primary" />
                Complaint receipts
              </CardTitle>
              <CardDescription>
                Each complaint generates a unique service receipt that can be shared during follow-up with the district office.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tokens.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-center">
                  <p className="text-lg font-semibold text-foreground">No receipts generated yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Submit your first complaint to receive a trackable national portal receipt.
                  </p>
                </div>
              ) : (
                tokens.map(token => <ReceiptCard key={token.id} token={token} />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

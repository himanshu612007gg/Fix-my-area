'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock3,
  Coins,
  Copy,
  CreditCard,
  Gift,
  History,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  WALLET_SYNC_EVENT,
  getUserRewardRedemptions,
  getUserStats,
  getUserTokens,
  redeemReward,
  RewardRedemption,
  Token,
  User,
  UserStats,
} from '@/lib/db';
import { getRewardOptionsForRole, RewardOption } from '@/lib/portal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TokenWalletProps {
  user: User;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN');
}

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied.`);
}

function CopyButton({ value, label, buttonText = 'Copy' }: { value?: string; label: string; buttonText?: string }) {
  if (!value) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" className="rounded-full" onClick={() => void copyToClipboard(value, label)}>
      <Copy className="h-4 w-4" />
      {buttonText}
    </Button>
  );
}

function RewardCard({
  reward,
  coins,
  selected,
  onSelect,
}: {
  reward: RewardOption;
  coins: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const affordable = coins >= reward.cost;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.6rem] border p-5 text-left transition ${
        selected
          ? 'border-primary/40 bg-primary/10 shadow-[0_25px_65px_-45px_rgba(249,115,22,0.65)]'
          : 'border-border/70 bg-background/75 hover:border-primary/20 hover:bg-background'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary">
              {reward.rewardKind === 'gift-card' ? 'Gift card' : 'Service benefit'}
            </Badge>
            <Badge variant="outline" className="rounded-full bg-muted/25 px-3 py-1 text-foreground">
              {reward.faceValue}
            </Badge>
          </div>
          <h3 className="mt-4 text-xl font-semibold text-foreground">{reward.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{reward.description}</p>
        </div>
        <div className="rounded-[1.2rem] border border-border/70 bg-card/80 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cost</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{reward.cost} coins</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Partner</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{reward.providerName}</p>
        </div>
        <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Settlement</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{reward.settlementChannel}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {reward.includes.map(item => (
          <Badge key={item} variant="outline" className="rounded-full bg-background/75 px-3 py-1 text-foreground">
            {item}
          </Badge>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm">
        <span className={affordable ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-semibold text-amber-700 dark:text-amber-300'}>
          {affordable ? 'Wallet ready' : `Need ${reward.cost - coins} more coins`}
        </span>
        <span className="text-muted-foreground">{selected ? 'Selected for issue' : reward.deliveryWindow}</span>
      </div>
    </button>
  );
}

function ReceiptCard({ token }: { token: Token }) {
  return (
    <div className="rounded-[1.45rem] border border-border/70 bg-background/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{token.postTitle}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{token.category}</p>
          <p className="mt-3 font-mono text-sm font-semibold text-primary">{token.id}</p>
        </div>
        <CopyButton value={token.id} label="Receipt ID" />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDateTime(token.issuedAt)}</span>
        <span className={token.status === 'redeemed' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
          {token.status === 'redeemed' ? 'Archived receipt' : 'Active receipt'}
        </span>
      </div>
    </div>
  );
}

export default function TokenWallet({ user }: TokenWalletProps) {
  const rewards = getRewardOptionsForRole(user.role);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RewardRedemption[]>([]);
  const [busyRewardId, setBusyRewardId] = useState<string | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(rewards[0]?.id ?? null);
  const [isWalletLoading, setIsWalletLoading] = useState(true);

  useEffect(() => {
    if (!rewards.length) {
      setSelectedRewardId(null);
      return;
    }

    if (!rewards.some(reward => reward.id === selectedRewardId)) {
      setSelectedRewardId(rewards[0].id);
    }
  }, [rewards, selectedRewardId]);

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      setIsWalletLoading(true);

      const [statsResult, tokensResult, historyResult] = await Promise.allSettled([
        getUserStats(user.id),
        getUserTokens(user.id),
        getUserRewardRedemptions(user.id),
      ]);

      if (cancelled) {
        return;
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        toast.error('Unable to load wallet balance right now.');
      }

      if (tokensResult.status === 'fulfilled') {
        setTokens(tokensResult.value);
      }

      if (historyResult.status === 'fulfilled') {
        setRewardHistory(historyResult.value);
      }

      setIsWalletLoading(false);
    };

    const handleWalletSync = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; stats?: UserStats; redemption?: RewardRedemption }>).detail;
      if (!detail || detail.userId !== user.id || cancelled) {
        return;
      }

      if (detail.stats) {
        setStats(detail.stats);
      }

      if (detail.redemption) {
        setRewardHistory(previous =>
          [detail.redemption!, ...previous.filter(entry => entry.id !== detail.redemption!.id)].sort(
            (first, second) => new Date(second.redeemedAt).getTime() - new Date(first.redeemedAt).getTime(),
          ),
        );
      }
    };

    void loadWallet();

    if (typeof window !== 'undefined') {
      window.addEventListener(WALLET_SYNC_EVENT, handleWalletSync);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(WALLET_SYNC_EVENT, handleWalletSync);
      }
    };
  }, [user.id]);

  const coins = stats?.creditCoins ?? 0;
  const redeemedCoins = stats?.redeemedCoins ?? rewardHistory.reduce((total, entry) => total + entry.cost, 0);
  const issuedCards = rewardHistory.filter(entry => entry.status === 'fulfilled').length;
  const selectedReward = rewards.find(reward => reward.id === selectedRewardId) || null;
  const latestRedemption = rewardHistory[0] || null;

  const handleRedeem = async () => {
    if (!selectedReward) {
      return;
    }

    setBusyRewardId(selectedReward.id);

    try {
      const { stats: nextStats, redemption } = await redeemReward(user.id, selectedReward);
      setStats(nextStats);
      setRewardHistory(previous => [redemption, ...previous.filter(entry => entry.id !== redemption.id)]);
      toast.success(`${selectedReward.title} issued successfully.`, {
        description: redemption.couponCode
          ? `Coupon ${redemption.couponCode} is now stored in your gift card vault.`
          : 'The reward is now visible in your transaction history.',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to redeem reward.');
    } finally {
      setBusyRewardId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl px-4">
        <section className="portal-card animate-rise-in overflow-hidden rounded-[2rem] border border-border/70 bg-card/85">
          <div className="grid gap-6 px-6 py-8 xl:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
                National rewards exchange
              </div>
              <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground lg:text-5xl">
                Redeem civic coins through a clean, auditable service wallet.
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                Every approved redemption is settled against your verified wallet, stored in a transaction ledger, and
                kept ready for re-copy whenever you need the coupon code again.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-4 py-2 text-primary">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verified wallet settlement
                </Badge>
                <Badge variant="outline" className="rounded-full bg-card/80 px-4 py-2 text-foreground">
                  <History className="mr-2 h-4 w-4" />
                  Redemption history retained
                </Badge>
                <Badge variant="outline" className="rounded-full bg-card/80 px-4 py-2 text-foreground">
                  <Gift className="mr-2 h-4 w-4" />
                  Coupon codes always available
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available coins</p>
                    <p className="text-3xl font-semibold text-foreground">{isWalletLoading ? '...' : coins}</p>
                  </div>
                </div>
              </div>

              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gift cards issued</p>
                    <p className="text-3xl font-semibold text-foreground">{isWalletLoading ? '...' : issuedCards}</p>
                  </div>
                </div>
              </div>

              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600">
                    <Landmark className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total redeemed</p>
                    <p className="text-3xl font-semibold text-foreground">{isWalletLoading ? '...' : redeemedCoins}</p>
                  </div>
                </div>
              </div>

              <div className="portal-stat">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-600">
                    {user.role === 'authority' ? <Building2 className="h-6 w-6" /> : <ReceiptText className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{user.role === 'authority' ? 'Cases resolved' : 'Complaints filed'}</p>
                    <p className="text-3xl font-semibold text-foreground">
                      {isWalletLoading ? '...' : user.role === 'authority' ? stats?.issuesResolved ?? 0 : stats?.postsCreated ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-[1.85rem] border-border/70 bg-card/85">
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Gift className="h-5 w-5 text-primary" />
                    Redemption catalogue
                  </CardTitle>
                  <CardDescription>
                    Professionally managed reward cards for {user.role === 'authority' ? 'workers and field officers' : 'citizen reporters'}.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-4 py-2 text-primary">
                  Wallet synced with current balance
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {rewards.map(reward => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  coins={coins}
                  selected={reward.id === selectedRewardId}
                  onSelect={() => setSelectedRewardId(reward.id)}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.85rem] border-border/70 bg-card/85 xl:sticky xl:top-24 xl:self-start">
            <CardHeader className="gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Settlement console
                </CardTitle>
                <CardDescription>Review one reward, confirm the wallet impact, and issue the code without a popup.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedReward ? (
                <>
                  <div className="rounded-[1.6rem] border border-primary/20 bg-gradient-to-b from-primary/10 via-card to-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full border-primary/20 bg-background/80 px-3 py-1 text-primary">
                            {selectedReward.rewardKind === 'gift-card' ? 'Digital gift card' : 'Service benefit'}
                          </Badge>
                          <Badge variant="outline" className="rounded-full bg-background/80 px-3 py-1 text-foreground">
                            {selectedReward.faceValue}
                          </Badge>
                        </div>
                        <h3 className="mt-4 text-2xl font-semibold text-foreground">{selectedReward.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedReward.description}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/70 bg-background/80 px-4 py-3 text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cost</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{selectedReward.cost} coins</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.2rem] border border-border/70 bg-background/75 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current balance</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">{isWalletLoading ? '...' : `${coins} coins`}</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/70 bg-background/75 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Redeem now</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">{selectedReward.cost} coins</p>
                      </div>
                      <div className="rounded-[1.2rem] border border-border/70 bg-background/75 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Balance after</p>
                        <p className="mt-2 text-xl font-semibold text-foreground">
                          {isWalletLoading ? '...' : `${Math.max(0, coins - selectedReward.cost)} coins`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.45rem] border border-border/70 bg-background/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What gets issued</p>
                    <div className="mt-4 space-y-3">
                      {selectedReward.includes.map(item => (
                        <div key={item} className="flex items-start gap-3 text-sm text-foreground">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Partner</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{selectedReward.providerName}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Settlement</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{selectedReward.settlementChannel}</p>
                    </div>
                  </div>

                  <div className="rounded-[1.35rem] border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      {selectedReward.fulfillmentType === 'instant' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Clock3 className="h-4 w-4 text-amber-600" />
                      )}
                      {selectedReward.fulfillmentType === 'instant' ? 'Instant issuance' : 'Queued issuance'}
                    </div>
                    <p className="mt-3 leading-6">{selectedReward.fulfillmentNote}</p>
                  </div>

                  {coins < selectedReward.cost && (
                    <div className="rounded-[1.35rem] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                      Earn {selectedReward.cost - coins} more coins before issuing this card.
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full rounded-full"
                    disabled={isWalletLoading || !stats || coins < selectedReward.cost || busyRewardId === selectedReward.id}
                    onClick={() => void handleRedeem()}
                  >
                    {busyRewardId === selectedReward.id ? `Issuing ${selectedReward.title}...` : `Redeem ${selectedReward.cost} coins`}
                  </Button>

                  {latestRedemption && (
                    <div className="rounded-[1.45rem] border border-primary/20 bg-primary/5 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Latest issued reward</p>
                      <h4 className="mt-3 text-lg font-semibold text-foreground">{latestRedemption.rewardTitle}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{latestRedemption.transactionReference}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <CopyButton value={latestRedemption.couponCode} label="Coupon code" buttonText="Copy code" />
                        <CopyButton value={latestRedemption.couponPin} label="Claim PIN" buttonText="Copy PIN" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-center">
                  <p className="text-lg font-semibold text-foreground">No reward selected</p>
                  <p className="mt-2 text-sm text-muted-foreground">Choose a card from the catalogue to review its settlement summary.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 rounded-[1.85rem] border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <History className="h-5 w-5 text-primary" />
              Wallet records
            </CardTitle>
            <CardDescription>Review the redemption ledger, gift card vault, and complaint receipts from one managed workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transactions" className="gap-5">
              <TabsList className="h-auto w-full flex-wrap rounded-[1rem] bg-muted/70 p-1">
                <TabsTrigger value="transactions" className="rounded-[0.8rem] px-4 py-2">Transactions</TabsTrigger>
                <TabsTrigger value="gift-cards" className="rounded-[0.8rem] px-4 py-2">Gift card vault</TabsTrigger>
                <TabsTrigger value="receipts" className="rounded-[0.8rem] px-4 py-2">Complaint receipts</TabsTrigger>
              </TabsList>
              <TabsContent value="transactions">
                {rewardHistory.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-center">
                    <p className="text-lg font-semibold text-foreground">No transactions yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Redeem your first reward card and it will appear here with its transaction reference and coupon details.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/70">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="px-4">Reward</TableHead>
                          <TableHead className="px-4">Transaction</TableHead>
                          <TableHead className="px-4">Coupon</TableHead>
                          <TableHead className="px-4">Status</TableHead>
                          <TableHead className="px-4">Wallet after</TableHead>
                          <TableHead className="px-4">Redeemed on</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rewardHistory.map(redemption => (
                          <TableRow key={redemption.id}>
                            <TableCell className="px-4 py-4">
                              <div>
                                <p className="font-semibold text-foreground">{redemption.rewardTitle}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{redemption.providerName}</p>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-foreground">{redemption.transactionReference}</span>
                                <CopyButton value={redemption.transactionReference} label="Transaction reference" />
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-foreground">
                                  {redemption.couponCode || (redemption.status === 'processing' ? 'Code pending issuance' : 'Code available in vault')}
                                </span>
                                <CopyButton value={redemption.couponCode} label="Coupon code" />
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <Badge
                                variant="outline"
                                className={redemption.status === 'fulfilled' ? 'rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
                              >
                                {redemption.status === 'fulfilled' ? 'Issued' : 'Processing'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-4 font-semibold text-foreground">{redemption.walletBalanceAfter} coins</TableCell>
                            <TableCell className="px-4 py-4 text-muted-foreground">{formatDateTime(redemption.redeemedAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gift-cards">
                {rewardHistory.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-center">
                    <p className="text-lg font-semibold text-foreground">Gift card vault is empty</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Issued coupon codes, claim PINs, and settlement references will stay here for future reuse.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {rewardHistory.map(redemption => (
                      <div key={redemption.id} className="rounded-[1.6rem] border border-border/70 bg-background/80 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={redemption.status === 'fulfilled' ? 'rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
                              >
                                {redemption.status === 'fulfilled' ? 'Issued' : 'Processing'}
                              </Badge>
                              <Badge variant="outline" className="rounded-full bg-muted/25 px-3 py-1 text-foreground">{redemption.faceValue}</Badge>
                            </div>
                            <h3 className="mt-4 text-xl font-semibold text-foreground">{redemption.rewardTitle}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{redemption.rewardDescription}</p>
                          </div>
                          <div className="rounded-[1.2rem] border border-border/70 bg-card/80 px-4 py-3 text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Coins used</p>
                            <p className="mt-2 text-xl font-semibold text-foreground">{redemption.cost}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Coupon code</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="font-mono text-sm font-semibold text-foreground">{redemption.couponCode || 'Issued at settlement desk'}</p>
                              <CopyButton value={redemption.couponCode} label="Coupon code" />
                            </div>
                          </div>
                          <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/15 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Claim PIN</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <p className="font-mono text-sm font-semibold text-foreground">{redemption.couponPin || 'Not required'}</p>
                              <CopyButton value={redemption.couponPin} label="Claim PIN" />
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                          <div className="rounded-[1.2rem] border border-border/70 bg-card/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Transaction ref</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">{redemption.transactionReference}</p>
                          </div>
                          <div className="rounded-[1.2rem] border border-border/70 bg-card/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wallet after</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">{redemption.walletBalanceAfter} coins</p>
                          </div>
                          <div className="rounded-[1.2rem] border border-border/70 bg-card/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Redeemed on</p>
                            <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(redemption.redeemedAt)}</p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground">
                          <span>{redemption.providerName}</span>
                          <span>{redemption.settlementChannel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="receipts">
                {tokens.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-8 text-center">
                    <p className="text-lg font-semibold text-foreground">No complaint receipts yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      File or resolve an issue to generate an official complaint receipt for follow-up.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {tokens.map(token => (
                      <ReceiptCard key={token.id} token={token} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

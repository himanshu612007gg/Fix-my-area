'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  FileBarChart,
  Loader2,
  ShieldCheck,
  Timer,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  assignComplaintToWorker,
  deletePost,
  getApprovedWorkers,
  getAuthorityUsers,
  getMonthlyWardReport,
  getPosts,
  getSLABreachedComplaints,
  getWorkerPerformance,
  Post,
  removeWorker,
  updateAuthorityApproval,
  User,
  WardReport,
  WorkerPerformance,
} from '@/lib/db';
import { CATEGORY_META, formatSLARemaining, isSLABreached } from '@/lib/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminDashboardProps {
  user: User;
}

type AdminTab = 'overview' | 'workers' | 'complaints' | 'sla' | 'performance' | 'reports';

function sanitizePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function wrapPdfLine(value: string, maxLength: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLength) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function downloadPdf(filename: string, pages: string[][]) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];

  pages.forEach(pageLines => {
    const contentLines = ['BT', '/F1 12 Tf', '50 790 Td', '16 TL'];
    pageLines.forEach((line, index) => {
      if (index > 0) {
        contentLines.push('T*');
      }
      contentLines.push(`(${sanitizePdfText(line)}) Tj`);
    });
    contentLines.push('ET');

    const stream = contentLines.join('\n');
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportWardReportPdf(reports: WardReport[], reportMonth: number, reportYear: number) {
  const monthLabel = new Date(reportYear, reportMonth - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
  const lines: string[] = [
    'Fix my area - Monthly location report',
    `Month: ${monthLabel} ${reportYear}`,
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    '',
  ];

  reports.forEach((report, index) => {
    lines.push(`Location group: ${report.ward}`);
    lines.push(`Total complaints: ${report.totalComplaints}`);
    lines.push(`Resolved: ${report.resolved} | Pending: ${report.pending}`);
    lines.push(`Average resolution days: ${report.averageResolutionDays}`);
    lines.push(`SLA breach rate: ${report.slaBreachRate}%`);
    lines.push(
      `Category breakdown: ${Object.entries(report.categoryBreakdown)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => `${category} ${count}`)
        .join(', ') || 'No complaint data'}`,
    );
    if (index < reports.length - 1) {
      lines.push('');
    }
  });

  const wrappedLines = lines.flatMap(line => wrapPdfLine(line, 88));
  const pageSize = 45;
  const pages: string[][] = [];

  for (let i = 0; i < wrappedLines.length; i += pageSize) {
    pages.push(wrappedLines.slice(i, i + pageSize));
  }

  downloadPdf(`location-report-${reportYear}-${String(reportMonth).padStart(2, '0')}.pdf`, pages);
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [pendingWorkers, setPendingWorkers] = useState<User[]>([]);
  const [approvedWorkers, setApprovedWorkers] = useState<User[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [slaBreached, setSlaBreached] = useState<Post[]>([]);
  const [performance, setPerformance] = useState<WorkerPerformance[]>([]);
  const [wardReports, setWardReports] = useState<WardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningPostId, setAssigningPostId] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [removingWorkerId, setRemovingWorkerId] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pending, approved, posts, breached, perf] = await Promise.all([
        getAuthorityUsers('pending'),
        getApprovedWorkers(),
        getPosts(),
        getSLABreachedComplaints(),
        getWorkerPerformance(),
      ]);
      setPendingWorkers(pending);
      setApprovedWorkers(approved);
      setAllPosts(posts);
      setSlaBreached(breached);
      setPerformance(perf);
    } catch {
      toast.error('Error loading admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleApproval = async (workerId: string, status: 'approved' | 'rejected') => {
    try {
      await updateAuthorityApproval(workerId, status, user.id);
      toast.success(`Worker ${status}`);
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    }
  };

  const handleAssign = async (postId: string) => {
    if (!selectedWorkerId) {
      toast.error('Select a worker first');
      return;
    }
    try {
      await assignComplaintToWorker(postId, selectedWorkerId, user.id);
      toast.success('Complaint assigned');
      setAssigningPostId(null);
      setSelectedWorkerId('');
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assignment failed');
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    try {
      const success = await deletePost(postId, user.firebaseUid || user.id, user.role);
      if (success) {
        setAllPosts(previous => previous.filter(post => post.id !== postId));
        setSlaBreached(previous => previous.filter(post => post.id !== postId));
        toast.success('Complaint deleted');
        await loadAll();
      } else {
        toast.error('Failed to delete — permission denied');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete complaint');
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleRemoveWorker = async (workerId: string, workerName: string) => {
    try {
      await removeWorker(workerId, user.firebaseUid || user.id);
      toast.success(`${workerName} has been removed`);
      setRemovingWorkerId(null);
      await loadAll();
    } catch (error) {
      console.error('Remove worker failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove worker');
    }
  };

  const loadReports = async () => {
    try {
      const reports = await getMonthlyWardReport(reportYear, reportMonth);
      setWardReports(reports);
      return reports;
    } catch {
      toast.error('Failed to load reports');
      return [];
    }
  };

  const handleGenerateReportPdf = async () => {
    setGeneratingReport(true);
    try {
      const reports = await loadReports();
      if (reports.length === 0) {
        toast.error('No report data available for the selected month.');
        return;
      }

      exportWardReportPdf(reports, reportMonth, reportYear);
      toast.success('PDF report generated.');
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate PDF report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  useEffect(() => {
    if (tab === 'reports') {
      void loadReports();
    }
  }, [tab, reportMonth, reportYear]);

  const unassignedPosts = allPosts.filter(p => p.status === 'submitted' && !p.assignedWorkerId);
  const totalActive = allPosts.filter(p => p.status !== 'resolved').length;
  const totalResolved = allPosts.filter(p => p.status === 'resolved').length;

  const tabs: Array<{ key: AdminTab; label: string; badge?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'workers', label: 'Workers', badge: pendingWorkers.length },
    { key: 'complaints', label: 'Complaints', badge: unassignedPosts.length },
    { key: 'sla', label: 'SLA Alerts', badge: slaBreached.length },
    { key: 'performance', label: 'Performance' },
    { key: 'reports', label: 'Reports' },
  ];

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
          <div className="portal-chip border-primary/20 bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
            Admin supervisor panel
          </div>
          <h2 className="portal-title mt-5 text-4xl font-semibold text-foreground">
            Municipality Control Room
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Approve workers, assign complaints, monitor SLA compliance, and generate location reports.
          </p>
        </section>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map(t => (
            <Button
              key={t.key}
              variant="ghost"
              onClick={() => setTab(t.key)}
              className={`rounded-full border ${tab === t.key ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-card/70'}`}
            >
              {t.label}
              {t.badge ? (
                <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{t.badge}</span>
              ) : null}
            </Button>
          ))}
        </div>

        <div className="mt-8">
          {/* ============================================ OVERVIEW ============================================ */}
          {tab === 'overview' && (
            <div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-[1.5rem] border-border/70"><CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-600"><Users className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Pending workers</p><p className="text-2xl font-semibold text-foreground">{pendingWorkers.length}</p></div>
                  </div>
                </CardContent></Card>
                <Card className="rounded-[1.5rem] border-border/70"><CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600"><FileBarChart className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Unassigned</p><p className="text-2xl font-semibold text-foreground">{unassignedPosts.length}</p></div>
                  </div>
                </CardContent></Card>
                <Card className="rounded-[1.5rem] border-border/70"><CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><BarChart3 className="h-5 w-5" /></div>
                    <div><p className="text-xs text-muted-foreground">Active cases</p><p className="text-2xl font-semibold text-foreground">{totalActive}</p></div>
                  </div>
                </CardContent></Card>
                <Card className="rounded-[1.5rem] border-border/70"><CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${slaBreached.length > 0 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div><p className="text-xs text-muted-foreground">SLA breaches</p><p className="text-2xl font-semibold text-foreground">{slaBreached.length}</p></div>
                  </div>
                </CardContent></Card>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border-border/70"><CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Total resolved</p><p className="mt-2 text-3xl font-semibold text-emerald-600">{totalResolved}</p>
                </CardContent></Card>
                <Card className="rounded-[1.5rem] border-border/70"><CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Approved workers</p><p className="mt-2 text-3xl font-semibold text-foreground">{approvedWorkers.length}</p>
                </CardContent></Card>
              </div>
            </div>
          )}

          {/* ============================================ WORKERS ============================================ */}
          {tab === 'workers' && (
            <div className="space-y-6">
              {/* Pending approvals */}
              <div>
                <h3 className="text-xl font-semibold text-foreground">Pending worker registrations</h3>
                {pendingWorkers.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No pending registrations.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pendingWorkers.map(worker => (
                      <Card key={worker.id} className="rounded-[1.5rem] border-border/70 bg-card/90">
                        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-foreground">{worker.name}</p>
                            <p className="text-sm text-muted-foreground">{worker.email}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Phone: <strong>{worker.phone || 'Not provided'}</strong>
                              {worker.phone && <span> · Phone: {worker.phone}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">Registered {new Date(worker.createdAt).toLocaleDateString('en-IN')}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => void handleApproval(worker.id, 'approved')} className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700">
                              <UserCheck className="mr-2 h-4 w-4" /> Approve
                            </Button>
                            <Button onClick={() => void handleApproval(worker.id, 'rejected')} variant="destructive" className="rounded-full">
                              <UserX className="mr-2 h-4 w-4" /> Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Approved workers */}
              <div>
                <h3 className="text-xl font-semibold text-foreground">Approved workers</h3>
                {approvedWorkers.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No approved workers yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {approvedWorkers.map(worker => (
                      <Card key={worker.id} className="rounded-[1.5rem] border-border/70 bg-card/90">
                        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{worker.name}</p>
                            <p className="text-sm text-muted-foreground">{worker.email}</p>
                            {worker.phone && <p className="mt-1 text-sm text-muted-foreground">Phone: {worker.phone}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {removingWorkerId === worker.id ? (
                              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-1.5">
                                <span className="text-sm font-medium text-red-600">Remove this worker?</span>
                                <Button onClick={() => void handleRemoveWorker(worker.id, worker.name)} size="sm" variant="destructive" className="rounded-full px-3">
                                  Yes, remove
                                </Button>
                                <Button onClick={() => setRemovingWorkerId(null)} size="sm" variant="ghost" className="rounded-full px-3">
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button onClick={() => setRemovingWorkerId(worker.id)} variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================ COMPLAINTS ============================================ */}
          {tab === 'complaints' && (
            <div>
              <h3 className="text-xl font-semibold text-foreground">All complaints</h3>
              <p className="mt-1 text-sm text-muted-foreground">Assign unassigned complaints to workers, remove workers, or delete spam.</p>

              <div className="mt-5 space-y-4">
                {allPosts.length === 0 ? (
                  <p className="text-muted-foreground">No complaints filed yet.</p>
                ) : (
                  allPosts.map(post => {
                    const breached = isSLABreached(post.slaDeadline, post.status);
                    const slaText = formatSLARemaining(post.slaDeadline, post.status);
                    const isAssigning = assigningPostId === post.id;
                    const isDeleting = deletingPostId === post.id;
                    const categoryMeta = CATEGORY_META[post.category];

                    return (
                      <Card key={post.id} className={`rounded-[1.5rem] border-border/70 bg-card/90 ${breached ? 'border-red-500/30' : ''}`}>
                        <CardContent className="p-5">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="portal-chip border-primary/20 bg-primary/10 text-primary">{categoryMeta?.icon} {post.category}</span>
                                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${
                                  post.status === 'resolved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                                  : post.status === 'submitted' ? 'border-sky-500/20 bg-sky-500/10 text-sky-600'
                                  : 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                                }`}>{post.status}</span>
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${breached ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  <Timer className="h-3 w-3" />{slaText}
                                </span>
                              </div>
                              <h4 className="mt-2 text-lg font-semibold text-foreground">{post.title}</h4>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {post.jurisdictionLabel} · PIN {post.locationDetails?.pincode || 'N/A'} · {post.referenceNumber}
                              </p>
                              {post.assignedWorkerName && (
                                <p className="mt-1 text-sm">
                                  <span className="text-muted-foreground">Assigned to:</span>{' '}
                                  <strong className="text-foreground">{post.assignedWorkerName}</strong>
                                </p>
                              )}
                              <p className="mt-1 text-sm text-muted-foreground">
                                PIN: {post.locationDetails?.pincode || 'Not specified'} | Place: {post.locationDetails?.locality || 'Not specified'}
                                {post.locationDetails?.landmark ? ` | Landmark: ${post.locationDetails.landmark}` : ''}
                              </p>
                              <p className="mt-2 text-sm text-foreground/80 line-clamp-2">{post.description}</p>
                            </div>
                            <div className="flex shrink-0 flex-col gap-2">
                              {post.status === 'submitted' && !post.assignedWorkerId && (
                                <Button onClick={() => { setAssigningPostId(isAssigning ? null : post.id); setSelectedWorkerId(''); }} size="sm" className="rounded-full">
                                  {isAssigning ? 'Cancel' : 'Assign worker'}
                                </Button>
                              )}
                              {post.assignedWorkerId && post.status !== 'resolved' && (
                                <Button
                                  onClick={() => setRemovingWorkerId(post.assignedWorkerId!)}
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                                >
                                  <UserX className="mr-1.5 h-3.5 w-3.5" /> Remove worker
                                </Button>
                              )}
                              <Button
                                onClick={() => void handleDeletePost(post.id)}
                                variant="ghost"
                                size="sm"
                                disabled={isDeleting}
                                className="rounded-full text-destructive hover:text-destructive"
                              >
                                {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                                {isDeleting ? 'Deleting...' : 'Delete complaint'}
                              </Button>
                            </div>
                          </div>
                          {isAssigning && (
                            <div className="mt-4 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                              <select
                                value={selectedWorkerId}
                                onChange={e => setSelectedWorkerId(e.target.value)}
                                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="">Select a worker...</option>
                                {approvedWorkers.map(w => (
                                  <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                              </select>
                              <Button onClick={() => void handleAssign(post.id)} className="rounded-full">
                                {post.assignedWorkerId ? 'Reassign' : 'Assign'}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ============================================ SLA ALERTS ============================================ */}
          {tab === 'sla' && (
            <div>
              <h3 className="text-xl font-semibold text-foreground">SLA breach alerts</h3>
              <p className="mt-1 text-sm text-muted-foreground">Complaints that have exceeded their SLA deadline.</p>

              {slaBreached.length === 0 ? (
                <Card className="mt-5 rounded-[1.5rem] border-dashed border-border/70">
                  <CardContent className="py-14 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                    <p className="mt-4 text-xl font-semibold text-foreground">All clear!</p>
                    <p className="mt-2 text-sm text-muted-foreground">No SLA breaches at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="mt-5 space-y-3">
                  {slaBreached.map(post => (
                    <Card key={post.id} className="rounded-[1.5rem] border-red-500/30 bg-red-500/5">
                      <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{post.title}</p>
                          <p className="text-sm text-muted-foreground">{post.category} · {post.referenceNumber}</p>
                          <p className="text-sm text-red-600 font-medium">{formatSLARemaining(post.slaDeadline, post.status)}</p>
                          {post.assignedWorkerName ? (
                            <p className="text-sm text-muted-foreground">Assigned to {post.assignedWorkerName}</p>
                          ) : (
                            <p className="text-sm text-amber-600 font-medium">⚠ Not assigned to any worker</p>
                          )}
                        </div>
                        {!post.assignedWorkerId && (
                          <Button onClick={() => { setTab('complaints'); setAssigningPostId(post.id); }} size="sm" className="rounded-full">
                            Assign now
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================ PERFORMANCE ============================================ */}
          {tab === 'performance' && (
            <div>
              <h3 className="text-xl font-semibold text-foreground">Worker performance dashboard</h3>
              <p className="mt-1 text-sm text-muted-foreground">Each worker&apos;s resolution stats and SLA compliance.</p>

              {performance.length === 0 ? (
                <p className="mt-5 text-muted-foreground">No worker data available yet.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {performance.map(perf => {
                    const resolutionRate = perf.totalAssigned > 0 ? Math.round((perf.totalResolved / perf.totalAssigned) * 100) : 0;
                    return (
                      <Card key={perf.workerId} className="rounded-[1.5rem] border-border/70 bg-card/90">
                        <CardContent className="p-5">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-lg font-semibold text-foreground">{perf.workerName}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-5">
                              <div className="text-center"><p className="text-xs text-muted-foreground">Assigned</p><p className="text-xl font-semibold">{perf.totalAssigned}</p></div>
                              <div className="text-center"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-xl font-semibold text-emerald-600">{perf.totalResolved}</p></div>
                              <div className="text-center"><p className="text-xs text-muted-foreground">In Progress</p><p className="text-xl font-semibold text-amber-600">{perf.totalInProgress}</p></div>
                              <div className="text-center"><p className="text-xs text-muted-foreground">Avg Time</p><p className="text-xl font-semibold">{perf.averageResolutionHours > 0 ? `${Math.round(perf.averageResolutionHours)}h` : '—'}</p></div>
                              <div className="text-center"><p className="text-xs text-muted-foreground">SLA Breach</p><p className={`text-xl font-semibold ${perf.slaBreachCount > 0 ? 'text-red-600' : 'text-foreground'}`}>{perf.slaBreachCount}</p></div>
                            </div>
                          </div>
                          {/* Simple progress bar for resolution rate */}
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Resolution rate</span>
                              <span className="font-semibold text-foreground">{resolutionRate}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/30">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                                style={{ width: `${resolutionRate}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================ REPORTS ============================================ */}
          {tab === 'reports' && (
            <div>
              <h3 className="text-xl font-semibold text-foreground">Monthly location reports</h3>
              <p className="mt-1 text-sm text-muted-foreground">Aggregated resolution data by PIN code or location for the selected month.</p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <select
                  value={reportMonth}
                  onChange={e => setReportMonth(Number(e.target.value))}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i, 1).toLocaleDateString('en-IN', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  value={reportYear}
                  onChange={e => setReportYear(Number(e.target.value))}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <Button onClick={() => void handleGenerateReportPdf()} variant="outline" className="rounded-full" disabled={generatingReport}>
                  {generatingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileBarChart className="mr-2 h-4 w-4" />} {generatingReport ? 'Generating PDF...' : 'Generate PDF'}
                </Button>
              </div>

              {wardReports.length === 0 ? (
                <p className="mt-5 text-muted-foreground">No data for this period. Select a month and click Generate.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {wardReports.map(report => (
                    <Card key={report.ward} className="rounded-[1.5rem] border-border/70 bg-card/90">
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-foreground">{report.ward}</p>
                            <p className="text-sm text-muted-foreground">{report.totalComplaints} total complaints</p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div className="text-center"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-xl font-semibold text-emerald-600">{report.resolved}</p></div>
                            <div className="text-center"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-semibold text-amber-600">{report.pending}</p></div>
                            <div className="text-center"><p className="text-xs text-muted-foreground">Avg Days</p><p className="text-xl font-semibold">{report.averageResolutionDays}</p></div>
                            <div className="text-center"><p className="text-xs text-muted-foreground">SLA Breach %</p><p className={`text-xl font-semibold ${report.slaBreachRate > 30 ? 'text-red-600' : 'text-foreground'}`}>{report.slaBreachRate}%</p></div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(Object.entries(report.categoryBreakdown) as [string, number][]).map(([cat, count]) => (
                            count > 0 && (
                              <span key={cat} className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
                                {cat}: {count}
                              </span>
                            )
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

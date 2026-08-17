'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  FileText,
  Radio,
  Users,
  Plus,
  Edit3,
  Trash2,
  Play,
  QrCode,
  BarChart3,
  Search,
  Presentation,
  Loader2,
  ChevronDown,
  LogOut,
  UserCog,
  LayoutDashboard,
  CalendarClock,
  HelpCircle,
  CircleDot,
  Copy,
  RotateCcw,
  KeyRound,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { AppFooter } from '@/components/shared/app-footer'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import type { ActivityDTO, ActivityStatus } from '@/lib/types'

interface ActivityWithCount extends ActivityDTO {
  _count?: { questions: number; participants: number }
  // The /api/activities GET returns these as flat fields (not nested under _count).
  questionCount?: number
  participantCount?: number
}

type FilterKey = 'all' | ActivityStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'LIVE', label: 'Live' },
  { key: 'COMPLETED', label: 'Completed' },
]

function StatusBadge({ status }: { status: ActivityStatus }) {
  if (status === 'LIVE') {
    return (
      <Badge className="gap-1.5 rounded-full border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/80" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        LIVE
      </Badge>
    )
  }
  if (status === 'PUBLISHED') {
    return (
      <Badge className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CircleDot className="h-3 w-3" />
        Published
      </Badge>
    )
  }
  if (status === 'COMPLETED') {
    return (
      <Badge
        variant="secondary"
        className="gap-1.5 rounded-full bg-muted text-muted-foreground"
      >
        Completed
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1.5 rounded-full bg-muted text-muted-foreground"
    >
      <FileText className="h-3 w-3" />
      Draft
    </Badge>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export function AdminDashboardScreen() {
  const admin = useAppStore((s) => s.admin)
  const navigate = useAppStore((s) => s.navigate)
  const setAdmin = useAppStore((s) => s.setAdmin)

  const [booting, setBooting] = useState(true)
  const [activities, setActivities] = useState<ActivityWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ActivityWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  // View access code
  const [codeActivity, setCodeActivity] = useState<ActivityWithCount | null>(null)

  // Clone dialog
  const [cloneTarget, setCloneTarget] = useState<ActivityWithCount | null>(null)
  const [cloneTitle, setCloneTitle] = useState('')
  const [clonePublishNow, setClonePublishNow] = useState(true)
  const [cloning, setCloning] = useState(false)

  // Reset dialog (only for COMPLETED)
  const [resetTarget, setResetTarget] = useState<ActivityWithCount | null>(null)
  const [resetMode, setResetMode] = useState<'keep' | 'regenerate'>('keep')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    // Give the page-level bootstrap a brief moment to hydrate admin state.
    const t = setTimeout(() => setBooting(false), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (booting) return
    if (!admin) {
      navigate('admin-login')
      return
    }
    void fetchActivities()
  }, [admin, booting, navigate])

  async function fetchActivities() {
    setLoading(true)
    try {
      const res = await api.get<{ activities: ActivityWithCount[] }>(
        '/api/activities',
      )
      setActivities(res.activities)
    } catch {
      toast.error('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filter !== 'all' && a.status !== filter) return false
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()))
        return false
      return true
    })
  }, [activities, filter, search])

  const stats = useMemo(() => {
    return {
      total: activities.length,
      liveOrPublished: activities.filter(
        (a) => a.status === 'PUBLISHED' || a.status === 'LIVE',
      ).length,
      participants: activities.reduce(
        (sum, a) =>
          sum + (a._count?.participants ?? a.participantCount ?? 0),
        0,
      ),
    }
  }, [activities])

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await api.post<{ activity: ActivityDTO }>('/api/activities', {
        title: newTitle.trim(),
        description: newDesc.trim(),
      })
      toast.success('Activity created')
      setCreateOpen(false)
      setNewTitle('')
      setNewDesc('')
      navigate('admin-editor', { activityId: res.activity.id })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create activity'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/activities/${deleteTarget.id}`)
      toast.success(`“${deleteTarget.title}” deleted`)
      setActivities((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete activity'
      toast.error(msg)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  function openClone(activity: ActivityWithCount) {
    setCloneTarget(activity)
    setCloneTitle(
      activity.title.toLowerCase().endsWith('(copy)')
        ? activity.title
        : `${activity.title} (Copy)`,
    )
    setClonePublishNow(true)
  }

  async function handleClone() {
    if (!cloneTarget) return
    setCloning(true)
    try {
      const res = await api.post<{
        activity: ActivityDTO
        warning: string | null
      }>(`/api/activities/${cloneTarget.id}/clone`, {
        title: cloneTitle.trim(),
        publishImmediately: clonePublishNow,
      })
      if (res.warning) {
        toast.warning(res.warning)
      } else if (clonePublishNow && res.activity.accessCode) {
        toast.success(
          `Cloned & published — new code ${res.activity.accessCode}`,
        )
      } else {
        toast.success(`Cloned as draft — “${res.activity.title}”`)
      }
      setCloneTarget(null)
      // Refresh list so the new clone appears in the correct tab.
      void fetchActivities()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to clone activity'
      toast.error(msg)
    } finally {
      setCloning(false)
    }
  }

  async function handleReset() {
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await api.post<{ activity: ActivityDTO }>(
        `/api/activities/${resetTarget.id}/reset`,
        { regenerateAccessCode: resetMode === 'regenerate' },
      )
      toast.success(
        `Reset complete — access code ${res.activity.accessCode ?? '—'}`,
      )
      setResetTarget(null)
      void fetchActivities()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to reset activity'
      toast.error(msg)
    } finally {
      setResetting(false)
    }
  }

  async function handleSignOut() {
    try {
      await api.post('/api/auth/logout')
    } catch {
      /* ignore */
    }
    setAdmin(null)
    toast.success('Signed out')
    navigate('landing')
  }

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
        <AppFooter />
      </div>
    )
  }

  if (!admin) return null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Atom Play</span>
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle className="h-10 w-10 rounded-xl" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 gap-2 rounded-xl px-2 pr-3"
                  aria-label="Account menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {admin.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span>{admin.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {admin.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('admin-dashboard')}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                {admin.role === 'SUPER_ADMIN' && (
                  <DropdownMenuItem onClick={() => navigate('admin-admins')}>
                    <UserCog className="h-4 w-4" />
                    Admin Management
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  variant="destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Greeting + create */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Good {greeting()},{' '}
              <span className="gradient-text">{admin.name.split(' ')[0]}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your quizzes, go live, and review audience responses.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-11 rounded-xl px-5"
            size="lg"
          >
            <Plus className="h-4 w-4" />
            Create Activity
          </Button>
        </div>

        {/* Stats */}
        <section
          aria-label="Stats"
          className="mt-8 grid gap-4 sm:grid-cols-3"
        >
          <StatCard
            label="Total activities"
            value={stats.total}
            icon={FileText}
            tint="text-chart-1"
            bg="bg-chart-1/10"
            loading={loading}
          />
          <StatCard
            label="Published & Live"
            value={stats.liveOrPublished}
            icon={Radio}
            tint="text-chart-2"
            bg="bg-chart-2/10"
            loading={loading}
          />
          <StatCard
            label="Total participants"
            value={stats.participants}
            icon={Users}
            tint="text-chart-3"
            bg="bg-chart-3/10"
            loading={loading}
          />
        </section>

        {/* Filters */}
        <section
          aria-label="Activities"
          className="mt-8 space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as FilterKey)}
            >
              <TabsList className="h-10 rounded-lg overflow-x-auto">
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.key} value={f.key} className="px-3">
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-lg pl-9"
                aria-label="Search activities"
              />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="rounded-2xl">
                  <CardContent className="flex flex-col gap-3 py-5">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-8 w-20 rounded-lg" />
                      <Skeleton className="h-8 w-20 rounded-lg" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={() => setCreateOpen(true)} hasAny={activities.length > 0} />
          ) : (
            <div className="grid max-h-[60vh] gap-4 overflow-y-auto scroll-thin pr-1">
              <AnimatePresence initial={false}>
                {filtered.map((activity) => (
                  <motion.div
                    key={activity.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ActivityCard
                      activity={activity}
                      onEdit={() =>
                        navigate('admin-editor', { activityId: activity.id })
                      }
                      onPresent={() =>
                        navigate('admin-present', { activityId: activity.id })
                      }
                      onResults={() =>
                        navigate('admin-results', { activityId: activity.id })
                      }
                      onViewCode={() => setCodeActivity(activity)}
                      onClone={() => openClone(activity)}
                      onReset={() => {
                        setResetTarget(activity)
                        setResetMode('keep')
                      }}
                      onDelete={() => setDeleteTarget(activity)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      <AppFooter />

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create a new activity</DialogTitle>
            <DialogDescription>
              Give your quiz a name and an optional description. You can add
              questions next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="act-title">Title</Label>
              <Input
                id="act-title"
                placeholder="e.g. Week 3 trivia — World Capitals"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-11 rounded-lg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-desc">Description (optional)</Label>
              <Textarea
                id="act-desc"
                placeholder="A short summary of what this quiz is about."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="rounded-lg"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create & edit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View access code dialog */}
      <Dialog
        open={!!codeActivity}
        onOpenChange={(open) => !open && setCodeActivity(null)}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Access code</DialogTitle>
            <DialogDescription>
              Share this 6-digit code with your participants. They can join
              from the landing page.
            </DialogDescription>
          </DialogHeader>
          {codeActivity && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-5">
                <QrCode className="h-10 w-10 text-primary" />
                <span className="font-mono text-5xl font-bold tracking-[0.3em] text-foreground">
                  {codeActivity.accessCode ?? '—'}
                </span>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {codeActivity.title}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (codeActivity?.accessCode) {
                  navigator.clipboard
                    ?.writeText(codeActivity.accessCode)
                    .then(() => toast.success('Code copied'))
                    .catch(() => toast.error('Copy failed'))
                }
              }}
              className="rounded-lg"
              disabled={!codeActivity?.accessCode}
            >
              Copy code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  You are about to permanently delete{' '}
                  <span className="font-medium text-foreground">
                    “{deleteTarget.title}”
                  </span>
                  . This removes all questions, participants, and answers.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clone dialog */}
      <Dialog
        open={!!cloneTarget}
        onOpenChange={(open) => {
          if (!open && !cloning) setCloneTarget(null)
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              Clone activity
            </DialogTitle>
            <DialogDescription>
              {cloneTarget && (
                <>
                  Create a fresh copy of{' '}
                  <span className="font-medium text-foreground">
                    “{cloneTarget.title}”
                  </span>{' '}
                  with all {cloneTarget._count?.questions ?? 0} questions.
                  Publishing immediately assigns a brand-new 6-digit access
                  code — a different channel from the original.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clone-title">Title for the clone</Label>
              <Input
                id="clone-title"
                placeholder="e.g. World Capitals (Copy)"
                value={cloneTitle}
                onChange={(e) => setCloneTitle(e.target.value)}
                className="h-11 rounded-lg"
                autoFocus
              />
            </div>
            <label
              htmlFor="clone-publish"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 hover:bg-muted/50"
            >
              <Checkbox
                id="clone-publish"
                checked={clonePublishNow}
                onCheckedChange={(v) => setClonePublishNow(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Publish immediately with a new access code
                </div>
                <p className="text-xs text-muted-foreground">
                  If unchecked, the clone is created as a DRAFT you can edit
                  before publishing.
                </p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloneTarget(null)}
              disabled={cloning}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClone}
              disabled={!cloneTitle.trim() || cloning}
              className="rounded-lg"
            >
              {cloning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cloning…
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Clone
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset dialog (COMPLETED only) */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open && !resetting) setResetTarget(null)
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Reset completed activity
            </DialogTitle>
            <DialogDescription>
              {resetTarget && (
                <>
                  This permanently deletes all{' '}
                  <span className="font-medium text-foreground">
                    {resetTarget._count?.participants ?? 0} participants
                  </span>{' '}
                  and their answers from{' '}
                  <span className="font-medium text-foreground">
                    “{resetTarget.title}”
                  </span>
                  . Questions stay intact and the activity returns to Published
                  so you can present it again.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <RadioGroup
              value={resetMode}
              onValueChange={(v) => setResetMode(v as 'keep' | 'regenerate')}
              className="gap-2"
            >
              <label
                htmlFor="reset-keep"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 hover:bg-muted/50"
              >
                <RadioGroupItem value="keep" id="reset-keep" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <KeyRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Keep the same access code
                    {resetTarget?.accessCode && (
                      <span className="font-mono text-xs text-muted-foreground">
                        #{resetTarget.accessCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended. Participants can re-join with the same code
                    they already have.
                  </p>
                </div>
              </label>
              <label
                htmlFor="reset-regen"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 hover:bg-muted/50"
              >
                <RadioGroupItem
                  value="regenerate"
                  id="reset-regen"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Generate a new access code
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A fresh 6-digit code is issued. Useful if the old one was
                    shared publicly.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={resetting}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              disabled={resetting}
              className="rounded-lg bg-amber-600 text-white hover:bg-amber-600/90"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Reset activity
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- Internal sub-components ----

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  bg,
  loading,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tint: string
  bg: string
  loading: boolean
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} ${tint}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityCard({
  activity,
  onEdit,
  onPresent,
  onResults,
  onViewCode,
  onClone,
  onReset,
  onDelete,
}: {
  activity: ActivityWithCount
  onEdit: () => void
  onPresent: () => void
  onResults: () => void
  onViewCode: () => void
  onClone: () => void
  onReset: () => void
  onDelete: () => void
}) {
  const qCount = activity._count?.questions ?? activity.questionCount ?? 0
  const pCount = activity._count?.participants ?? activity.participantCount ?? 0
  return (
    <Card className="rounded-2xl transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={activity.status} />
            {activity.accessCode && (
              <span className="font-mono text-xs text-muted-foreground">
                #{activity.accessCode}
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate text-lg font-semibold" title={activity.title}>
            {activity.title}
          </h3>
          {activity.description ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {activity.description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              {qCount} {qCount === 1 ? 'question' : 'questions'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {pCount} {pCount === 1 ? 'participant' : 'participants'}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              created {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activity.status === 'DRAFT' && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} className="h-9 rounded-lg">
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClone}
                className="h-9 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                aria-label={`Clone ${activity.title}`}
                title="Clone activity"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${activity.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {activity.status === 'PUBLISHED' && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} className="h-9 rounded-lg">
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={onPresent} size="sm" className="h-9 rounded-lg">
                <Play className="h-4 w-4" />
                Present
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onViewCode}
                className="h-9 rounded-lg"
              >
                <QrCode className="h-4 w-4" />
                View code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClone}
                className="h-9 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                aria-label={`Clone ${activity.title}`}
                title="Clone activity"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${activity.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {activity.status === 'LIVE' && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} className="h-9 rounded-lg">
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button onClick={onPresent} size="sm" className="h-9 rounded-lg">
                <Play className="h-4 w-4" />
                Present
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClone}
                className="h-9 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                aria-label={`Clone ${activity.title}`}
                title="Clone activity"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </>
          )}
          {activity.status === 'COMPLETED' && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} className="h-9 rounded-lg">
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onResults}
                className="h-9 rounded-lg"
              >
                <BarChart3 className="h-4 w-4" />
                Results
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="h-9 rounded-lg text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400"
                aria-label={`Reset ${activity.title}`}
                title="Reset to present again"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClone}
                className="h-9 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                aria-label={`Clone ${activity.title}`}
                title="Clone activity"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${activity.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({
  onCreate,
  hasAny,
}: {
  onCreate: () => void
  hasAny: boolean
}) {
  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Presentation className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {hasAny ? 'Nothing matches your filters' : 'Create your first activity'}
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {hasAny
              ? 'Try a different status filter or search term.'
              : 'Draft questions, publish to get an access code, and present live to your audience.'}
          </p>
        </div>
        {!hasAny && (
          <Button onClick={onCreate} className="h-11 rounded-xl px-5">
            <Plus className="h-4 w-4" />
            Create Activity
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Users,
  HelpCircle,
  Percent,
  Trophy,
  Target,
  ChevronDown,
  LogOut,
  UserCog,
  LayoutDashboard,
  Award,
  ListOrdered,
  BarChart3,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { AppFooter } from '@/components/shared/app-footer'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { ResultBars } from '@/components/shared/result-bars'
import { LeaderboardChart } from '@/components/shared/leaderboard-chart'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type {
  ActivityDTO,
  ActivityResultsResponse,
  LeaderboardEntry,
  OptionKey,
} from '@/lib/types'

interface OptionLabels {
  A: string
  B: string
  C: string
  D: string
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function FinalResultsScreen() {
  const params = useAppStore((s) => s.params)
  const admin = useAppStore((s) => s.admin)
  const navigate = useAppStore((s) => s.navigate)
  const setAdmin = useAppStore((s) => s.setAdmin)

  const activityId = params.activityId

  const [booting, setBooting] = useState(true)
  const [results, setResults] = useState<ActivityResultsResponse | null>(null)
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [labelsByQ, setLabelsByQ] = useState<Record<string, OptionLabels>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (booting) return
    if (!admin) {
      navigate('admin-login')
      return
    }
    if (!activityId) {
      setNotFound(true)
      return
    }
    void fetchAll()
  }, [admin, booting, activityId, navigate])

  async function fetchAll() {
    setLoading(true)
    try {
      const [activityRes, resultsRes, leaderboardRes] = await Promise.all([
        api.get<{ activity: ActivityDTO }>(`/api/activities/${activityId}`),
        api.get<ActivityResultsResponse>(`/api/activities/${activityId}/results`),
        api.get<{ entries: LeaderboardEntry[] }>(`/api/activities/${activityId}/leaderboard`),
      ])
      const labelsMap: Record<string, OptionLabels> = {}
      for (const q of activityRes.activity.questions ?? []) {
        labelsMap[q.id] = {
          A: q.optionA,
          B: q.optionB,
          C: q.optionC,
          D: q.optionD,
        }
      }
      setLabelsByQ(labelsMap)
      setResults(resultsRes)
      setLeaderboardEntries(leaderboardRes.entries)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true)
      } else {
        toast.error('Failed to load results')
      }
    } finally {
      setLoading(false)
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
      <div className="flex min-h-screen flex-col bg-stage-stage">
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
        <AppFooter />
      </div>
    )
  }

  if (!admin) return null

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col bg-stage-stage">
        <ResultsHeader
          admin={admin}
          onBack={() => navigate('admin-dashboard')}
          onSignOut={handleSignOut}
          onNavigateAdmins={() => navigate('admin-admins')}
        />
        <main className="w-full flex-1 px-4 py-16 text-center sm:px-8 lg:px-12 xl:px-16">
          <h1 className="text-2xl font-bold">Results not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This activity may have been deleted, or you do not have access to it.
          </p>
          <Button
            onClick={() => navigate('admin-dashboard')}
            className="mt-6 h-11 rounded-xl px-5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </main>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-stage-stage">
      <ResultsHeader
        admin={admin}
        onBack={() => navigate('admin-dashboard')}
        onSignOut={handleSignOut}
        onNavigateAdmins={() => navigate('admin-admins')}
      />

      <main className="w-full flex-1 px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        {loading || !results ? (
          <ResultsSkeleton />
        ) : (
          <>
            {/* Hero */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-center"
            >
              <Badge
                variant="secondary"
                className="mb-4 gap-1.5 border-primary/30 bg-primary/15 text-primary"
              >
                <Trophy className="h-3.5 w-3.5" />
                Quiz Complete
              </Badge>
              <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {results.title}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Final scoreboard and per-question breakdown.
              </p>
            </motion.section>

            {/* Big stats grid */}
            <section
              aria-label="Summary"
              className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
            >
              <BigStat
                icon={HelpCircle}
                label="Questions"
                value={`${results.totalQuestions}`}
                tint="text-chart-1"
                bg="bg-chart-1/10"
              />
              <BigStat
                icon={Users}
                label="Participants"
                value={`${results.totalParticipants}`}
                tint="text-chart-2"
                bg="bg-chart-2/10"
              />
              <BigStat
                icon={Percent}
                label="Participation"
                value={`${results.participation}%`}
                tint="text-chart-3"
                bg="bg-chart-3/10"
              />
              <BigStat
                icon={Target}
                label="Avg. score"
                value={`${results.averageScore}`}
                tint="text-chart-4"
                bg="bg-chart-4/10"
              />
              <BigStat
                icon={Award}
                label="Top score"
                value={`${results.highestScore}`}
                tint="text-chart-5"
                bg="bg-chart-5/10"
              />
            </section>

            {/* Tab view: Leaderboard + Analytics */}
            <section className="mt-10">
              <Tabs defaultValue="leaderboard" className="w-full">
                <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto">
                  <TabsTrigger value="leaderboard" className="gap-1.5 px-4">
                    <Trophy className="h-4 w-4" />
                    Leaderboard
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="gap-1.5 px-4">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Leaderboard */}
                <TabsContent value="leaderboard" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        Final Leaderboard
                      </CardTitle>
                      <CardDescription>
                        Ranked by total score (1000 base per correct answer + time bonus).
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LeaderboardChart
                        entries={leaderboardEntries}
                        showScoreBreakdown
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2: Analytics (per-question breakdown) */}
                <TabsContent value="analytics" className="mt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <ListOrdered className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold tracking-tight">
                      Question breakdown
                    </h2>
                  </div>

                  {results.questions.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No questions on this activity.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-5">
                      {results.questions.map((q, idx) => {
                        const labels = labelsByQ[q.id] ?? {
                          A: 'Option A',
                          B: 'Option B',
                          C: 'Option C',
                          D: 'Option D',
                        }
                        const correctPct =
                          q.distribution.total > 0
                            ? Math.round(
                                (q.distribution[q.correctOption] /
                                  q.distribution.total) *
                                  100,
                              )
                            : 0
                        return (
                          <motion.div
                            key={q.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: idx * 0.05 }}
                          >
                            <Card>
                              <CardHeader className="gap-2">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  <span className="inline-flex h-6 w-6 items-center justify-center bg-primary/10 text-primary">
                                    Q{q.questionOrder}
                                  </span>
                                  <span>{q.distribution.total} responses</span>
                                  <span className="text-muted-foreground/60">·</span>
                                  <span className="text-primary">
                                    {correctPct}% correct
                                  </span>
                                </div>
                                <CardTitle className="text-lg leading-snug sm:text-xl">
                                  {q.questionText}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <ResultBars
                                  distribution={q.distribution}
                                  labels={labels as Partial<Record<OptionKey, string>>}
                                  correctOption={q.correctOption}
                                  variant="bars"
                                />
                              </CardContent>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>

            <div className="mt-10 flex justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('admin-dashboard')}
                className="h-11 px-6"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Button>
            </div>
          </>
        )}
      </main>

      <AppFooter />
    </div>
  )
}

// ---- Internal sub-components ----

function ResultsHeader({
  admin,
  onBack,
  onSignOut,
  onNavigateAdmins,
}: {
  admin: { id: string; name: string; email: string; role: 'ADMIN' | 'SUPER_ADMIN' }
  onBack: () => void
  onSignOut: () => void
  onNavigateAdmins: () => void
}) {
  return (
    <header className="sticky top-0 z-30 glass-bar backdrop-blur-md backdrop-saturate-150">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-10 gap-1.5 rounded-xl px-2 text-muted-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div className="hidden items-center gap-2.5 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Atom Play</span>
          </div>
        </div>
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
              <DropdownMenuItem onClick={onBack}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </DropdownMenuItem>
              {admin.role === 'SUPER_ADMIN' && (
                <DropdownMenuItem onClick={onNavigateAdmins}>
                  <UserCog className="h-4 w-4" />
                  Admin Management
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} variant="destructive">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function BigStat({
  icon: Icon,
  label,
  value,
  tint,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tint: string
  bg: string
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-3xl font-bold tabular-nums sm:text-4xl">{value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </CardContent>
    </Card>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <Skeleton className="mx-auto h-6 w-32 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-10 w-2/3 rounded-lg" />
        <Skeleton className="mx-auto mt-2 h-4 w-1/3 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="flex flex-col items-center gap-2 py-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-2xl">
            <CardHeader>
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="mt-2 h-6 w-3/4 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-full rounded" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

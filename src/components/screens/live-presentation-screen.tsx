'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import { useCountdown, formatTime } from '@/hooks/use-countdown'
import { ResultBars } from '@/components/shared/result-bars'
import { LeaderboardChart } from '@/components/shared/leaderboard-chart'
import { ParticipantsSheet, type ParticipantRow } from '@/components/shared/participants-sheet'
import { colorForParticipantById, getParticipantIconById } from '@/lib/participant-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Flag,
  Loader2,
  LogOut,
  Maximize,
  Minimize,
  Play,
  Radio,
  RotateCcw,
  Square,
  Trophy,
  UserRound,
} from 'lucide-react'
import type {
  ActivityDTO,
  ActivityCompletedPayload,
  AnswerDistribution,
  LeaderboardEntry,
  LeaderboardSectionDTO,
  LeaderboardShownPayload,
  OptionKey,
  ParticipantJoinedPayload,
  ParticipantKickedPayload,
  QuestionDTO,
  QuestionEndedPayload,
  QuestionStartedPayload,
  ResultsUpdatedPayload,
} from '@/lib/types'

type Phase = 'loading' | 'lobby' | 'ready' | 'question' | 'reveal' | 'leaderboard' | 'completed'

interface LiveQuestion {
  questionId: string
  questionOrder: number
  totalQuestions: number
  questionText: string
  options: { key: OptionKey; label: string }[]
  endsAt: string
}

// NOTE: participant color assignment now lives in src/lib/participant-icons.tsx
// (`colorForParticipant`) and is SHARED with the participants sheet so a given
// participant shows the exact same color in both the lobby bubble stage and the
// participants sheet rows.

// Phyllotaxis "sunflower" layout — the first participant is pinned to the
// center as a large anchor bubble, and each subsequent joiner spawns around
// them at the golden angle (137.5°). The cluster stays balanced as it grows
// and every outside bubble gets its own size + independent drift animation
// so the whole field shimmers gently instead of rigidly rotating.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)) // ~2.39996 rad = 137.5°

const CENTER_BUBBLE_DIAMETER = 132 // first user — large anchor
const OUTSIDE_BUBBLE_MIN = 44 // smallest outside circle
const OUTSIDE_BUBBLE_MAX = 72 // largest outside circle
const DRIFT_AMPLITUDE = 6 // ±px movement for outside bubbles

function phyllotaxisPosition(i: number): { x: number; y: number } {
  if (i === 0) return { x: 0, y: 0 } // first user — dead center
  const r = 78 + 24 * Math.sqrt(i)
  const theta = i * GOLDEN_ANGLE
  return { x: Math.cos(theta) * r, y: Math.sin(theta) * r }
}

// Deterministic pseudo-random in [0, 1) from a string seed — keeps each
// bubble's size + drift stable across reloads and re-renders.
function seededRand(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) | 0
  return (Math.abs(h) % 10000) / 10000
}

function bubbleDiameter(name: string, idx: number): number {
  const r = seededRand(`${name}-${idx}-size`)
  return OUTSIDE_BUBBLE_MIN + r * (OUTSIDE_BUBBLE_MAX - OUTSIDE_BUBBLE_MIN)
}

// Each outside bubble drifts on its own tiny loop so the cluster feels alive
// without any big rotation. Returns x/y keyframes + loop timing.
function bubbleDrift(name: string, idx: number) {
  const r1 = seededRand(`${name}-${idx}-x1`)
  const r2 = seededRand(`${name}-${idx}-x2`)
  const r3 = seededRand(`${name}-${idx}-y1`)
  const r4 = seededRand(`${name}-${idx}-y2`)
  const r5 = seededRand(`${name}-${idx}-dur`)
  const r6 = seededRand(`${name}-${idx}-delay`)
  return {
    x: [0, (r1 - 0.5) * 2 * DRIFT_AMPLITUDE, 0, (r2 - 0.5) * 2 * DRIFT_AMPLITUDE, 0],
    y: [0, (r3 - 0.5) * 2 * DRIFT_AMPLITUDE, 0, (r4 - 0.5) * 2 * DRIFT_AMPLITUDE, 0],
    duration: 5 + r5 * 4, // 5..9s
    delay: r6 * 2, // 0..2s
  }
}

// Adaptive scale — keeps the phyllotaxis cluster fitting inside the viewport as
// the participant count grows. Computed from the outermost bubble's distance
// + max bubble size, clamped to [0.4, 1] so it never gets unreadable or huge.
function computeClusterScale(count: number, vw: number, vh: number): number {
  const outer = 78 + 24 * Math.sqrt(Math.max(0, count - 1)) + OUTSIDE_BUBBLE_MAX / 2
  const diameter = outer * 2
  // Leave room for header (~180px) + start button (~90px) + side padding.
  const avail = Math.min(vw - 64, vh - 280)
  if (avail <= 0) return 0.5
  const raw = avail / diameter
  return Math.max(0.4, Math.min(1, raw))
}

const OPTION_TINTS: Record<OptionKey, string> = {
  A: 'bg-chart-1/20 text-chart-1 border-chart-1/60',
  B: 'bg-chart-2/20 text-chart-2 border-chart-2/60',
  C: 'bg-chart-3/20 text-chart-3 border-chart-3/60',
  D: 'bg-chart-4/20 text-chart-4 border-chart-4/60',
}

// Neon glow box-shadows per option — keyed to the same chart colors.
const OPTION_GLOWS: Record<OptionKey, string> = {
  A: '0 0 24px -6px oklch(0.72 0.28 350 / 0.45)',
  B: '0 0 24px -6px oklch(0.82 0.17 195 / 0.45)',
  C: '0 0 24px -6px oklch(0.82 0.24 140 / 0.45)',
  D: '0 0 24px -6px oklch(0.80 0.19 75 / 0.45)',
}

function buildLiveFromDTO(q: QuestionDTO, total: number): LiveQuestion {
  return {
    questionId: q.id,
    questionOrder: q.questionOrder,
    totalQuestions: total,
    questionText: q.questionText,
    options: [
      { key: 'A', label: q.optionA },
      { key: 'B', label: q.optionB },
      { key: 'C', label: q.optionC },
      { key: 'D', label: q.optionD },
    ],
    endsAt: '', // populated by caller using activity.questionEndsAt
  }
}

function labelsFromLive(q: LiveQuestion | null): Partial<Record<OptionKey, string>> {
  if (!q) return {}
  const out: Partial<Record<OptionKey, string>> = {}
  for (const o of q.options) out[o.key] = o.label
  return out
}

// Build the merged sequence of questions + leaderboards (mirrors the editor's
// left-rail order): for each question in questionOrder asc, push the question
// then any leaderboard whose `afterQuestionOrder` matches it, then push the
// single default (final) leaderboard at the end (if any).
type PresentationItem =
  | { type: 'question'; data: QuestionDTO }
  | { type: 'leaderboard'; data: LeaderboardSectionDTO }

function buildPresentationSequence(
  questions: QuestionDTO[],
  leaderboards: LeaderboardSectionDTO[],
): PresentationItem[] {
  const items: PresentationItem[] = []
  const sortedQuestions = [...questions].sort((a, b) => a.questionOrder - b.questionOrder)
  for (const q of sortedQuestions) {
    items.push({ type: 'question', data: q })
    const lb = leaderboards.find((l) => l.afterQuestionOrder === q.questionOrder)
    if (lb) items.push({ type: 'leaderboard', data: lb })
  }
  const defaultLb = leaderboards.find((l) => l.isDefault)
  if (defaultLb) items.push({ type: 'leaderboard', data: defaultLb })
  return items
}

export function LivePresentationScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const admin = useAppStore((s) => s.admin)
  const params = useAppStore((s) => s.params)
  const activityId = params.activityId

  const [activity, setActivity] = useState<ActivityDTO | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [current, setCurrent] = useState<LiveQuestion | null>(null)
  const [distribution, setDistribution] = useState<AnswerDistribution | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  // List of participants shared between the lobby bubble stage AND the
  // participants sheet. Populated on mount via REST, appended on every
  // `participant_joined` socket event, and re-synced from the sheet's REST
  // fetch whenever the sheet opens (so a missed socket event never leaves
  // the bubble stage stale).
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  // Track viewport size so the bubble cluster can rescale to fit as the window
  // resizes and as the participant count grows (70+ users still fit cleanly).
  const [viewport, setViewport] = useState({ w: 1280, h: 720 })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const clusterScale = computeClusterScale(participants.length, viewport.w, viewport.h)
  const [reveal, setReveal] = useState<{
    correctOption: OptionKey
    distribution: AnswerDistribution
  } | null>(null)
  // Leaderboard phase state. `leaderboardData` holds the currently-shown
  // leaderboard; `prevLeaderboardData` holds the previously-shown one so the
  // LeaderboardChart can animate from old positions to new ones.
  const [leaderboardData, setLeaderboardData] = useState<{
    leaderboardId: string
    title: string
    entries: LeaderboardEntry[]
    isDefault: boolean
  } | null>(null)
  const [prevLeaderboardData, setPrevLeaderboardData] = useState<typeof leaderboardData>(null)
  const [exiting, setExiting] = useState(false)
  // Confirm-and-reset dialog state. When the admin clicks "Exit" on the live
  // presentation screen, we open this dialog. On confirm, we (1) broadcast
  // `activity_reset` to all connected participants via socket so they are sent
  // back to the join screen, (2) call POST /api/activities/[id]/reset which
  // wipes participants + answers and returns the activity to PUBLISHED
  // (start mode), and (3) navigate back to the dashboard.
  const [confirmExit, setConfirmExit] = useState(false)
  const [resetting, setResetting] = useState(false)
  // Participants sheet — accessible throughout the activity (lobby, ready,
  // question, reveal) but NOT on the completed/results screen.
  const [sheetOpen, setSheetOpen] = useState(false)

  // -------- Fullscreen toggle --------
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])

  // -------- REST: fetch activity + recover phase on (re)load --------
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!activityId) return
      try {
        const res = await api.get<{ activity: ActivityDTO }>(`/api/activities/${activityId}`)
        if (cancelled) return
        setActivity(res.activity)
        setParticipantCount(0) // will be updated by socket/REST state

        const a = res.activity
        if (a.status === 'COMPLETED') {
          setPhase('completed')
          return
        }
        if (a.status === 'PUBLISHED') {
          setPhase('lobby')
          // Fetch the participants that joined before this admin opened the
          // present screen (late-host scenario). New joins after this arrive
          // via the `participant_joined` socket event.
          try {
            const pr = await api.get<{ participants: ParticipantRow[] }>(
              `/api/activities/${activityId}/participants`,
            )
            if (cancelled) return
            setParticipants(pr.participants)
            setParticipantCount(pr.participants.length)
          } catch {
            /* non-fatal — bubbles just won't show pre-existing joins */
          }
          return
        }
        if (a.status === 'LIVE') {
          if (a.currentQuestionId) {
            const q = (a.questions ?? []).find((x) => x.id === a.currentQuestionId)
            if (q) {
              const live = buildLiveFromDTO(q, (a.questions ?? []).length)
              live.endsAt = a.questionEndsAt ?? new Date().toISOString()
              // Fetch current distribution + correct option for late-join sync.
              try {
                const r = await api.get<{
                  questionId: string
                  distribution: AnswerDistribution
                  correctOption: OptionKey
                }>(`/api/questions/${q.id}/results`)
                if (cancelled) return
                const endsAtMs = a.questionEndsAt ? new Date(a.questionEndsAt).getTime() : 0
                if (endsAtMs > 0 && Date.now() < endsAtMs) {
                  setCurrent(live)
                  setDistribution(r.distribution)
                  setPhase('question')
                } else {
                  // Question already elapsed — show reveal.
                  setCurrent(live)
                  setReveal({ correctOption: r.correctOption, distribution: r.distribution })
                  setPhase('reveal')
                }
              } catch {
                if (cancelled) return
                // Results fetch failed — still set the question.
                setCurrent(live)
                setPhase('question')
              }
              return
            }
          }
          // LIVE & showing a leaderboard (currentQuestionId null, currentLeaderboardId set).
          if (a.currentLeaderboardId && !a.currentQuestionId) {
            try {
              const stateRes = await api.get<{
                currentLeaderboard?: {
                  leaderboardId: string
                  title: string
                  isDefault: boolean
                  entries: LeaderboardEntry[]
                }
              }>(`/api/activities/${activityId}/state`)
              if (cancelled) return
              if (stateRes.currentLeaderboard) {
                setLeaderboardData({
                  leaderboardId: stateRes.currentLeaderboard.leaderboardId,
                  title: stateRes.currentLeaderboard.title,
                  entries: stateRes.currentLeaderboard.entries,
                  isDefault: stateRes.currentLeaderboard.isDefault,
                })
                setPhase('leaderboard')
              } else {
                setPhase('ready')
              }
            } catch {
              if (cancelled) return
              setPhase('ready')
            }
            return
          }
          // LIVE but no current question — admin needs to start Q1.
          setPhase('ready')
          return
        }
        // DRAFT or unknown — send to dashboard.
        navigate('admin-dashboard')
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof ApiError ? err.message : 'Failed to load activity'
        toast.error(msg)
        if (err instanceof ApiError && err.status === 401) {
          navigate('admin-login')
        } else if (err instanceof ApiError && err.status === 404) {
          navigate('admin-dashboard')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activityId, navigate])

  // -------- Socket: host join + listeners --------
  useEffect(() => {
    if (!activityId || !admin) return
    const socket = getSocket()
    socket.emit('host_activity', { activityId, adminId: admin.id })
  }, [activityId, admin])

  // Listener effect — depends only on activityId + navigate (stable).
  const onQuestionStarted = useCallback((p: QuestionStartedPayload) => {
    setCurrent({
      questionId: p.questionId,
      questionOrder: p.questionOrder,
      totalQuestions: p.totalQuestions,
      questionText: p.questionText,
      options: p.options,
      endsAt: p.endsAt,
    })
    setDistribution({ A: 0, B: 0, C: 0, D: 0, total: 0 })
    setReveal(null)
    setPhase('question')
  }, [])

  const onQuestionEnded = useCallback((p: QuestionEndedPayload) => {
    setReveal({ correctOption: p.correctOption, distribution: p.distribution })
    setPhase('reveal')
  }, [])

  const onResultsUpdated = useCallback((p: ResultsUpdatedPayload) => {
    setDistribution(p.distribution)
    setParticipantCount(p.participantCount)
  }, [])

  const onParticipantJoined = useCallback((p: ParticipantJoinedPayload) => {
    setParticipantCount(p.count)
    // Append the new participant to the bubble list. The server now sends the
    // real DB id (`participantId`) so we use it directly — this means a later
    // `participant_kicked` event (which carries the same id) can correctly
    // remove the bubble, and the sheet's REST fetch won't duplicate the row.
    setParticipants((prev) => {
      const next: ParticipantRow = {
        id: p.participantId,
        displayName: p.displayName,
        uoid: p.uoid ?? null,
      }
      // De-dupe by id first, then by (displayName, uoid) as a fallback for the
      // rare race where the REST fetch already added the same row.
      if (prev.some((x) => x.id === next.id)) return prev
      if (
        prev.some(
          (x) => x.displayName === next.displayName && x.uoid === next.uoid,
        )
      ) {
        return prev
      }
      return [...prev, next]
    })
  }, [])

  const onActivityStarted = useCallback(() => {
    setPhase('ready')
  }, [])

  const onActivityCompleted = useCallback(() => {
    setPhase('completed')
  }, [])

  // When the server broadcasts a leaderboard (either because this admin
  // clicked "Leaderboard" or because the server is replaying state to a late
  // joiner), stash the entries + previous entries (for animation) and switch
  // to the leaderboard phase.
  const onLeaderboardShown = useCallback((p: LeaderboardShownPayload) => {
    setPrevLeaderboardData(leaderboardData) // keep previous for animation
    setLeaderboardData({
      leaderboardId: p.leaderboardId,
      title: p.title,
      entries: p.entries,
      isDefault: p.isDefault,
    })
    setPhase('leaderboard')
  }, [leaderboardData])

  // When a participant is kicked, remove their bubble + update the count.
  const onParticipantKicked = useCallback((p: ParticipantKickedPayload) => {
    setParticipantCount(p.count)
    setParticipants((prev) => prev.filter((x) => x.id !== p.participantId))
  }, [])

  // Merge the sheet's REST result with our existing list. The REST response is
  // authoritative for DB state (real cuids, correct order), but a participant
  // may have joined via socket in the tiny race window between the REST
  // request starting and its response arriving — preserve those entries so
  // their bubble doesn't briefly disappear. De-dupe by id, then by
  // (displayName, uoid) as a fallback.
  const handleParticipantsChange = useCallback((fresh: ParticipantRow[]) => {
    setParticipants((prev) => {
      const merged = [...fresh]
      for (const p of prev) {
        if (merged.some((m) => m.id === p.id)) continue
        if (
          merged.some(
            (m) => m.displayName === p.displayName && m.uoid === p.uoid,
          )
        ) {
          continue
        }
        merged.push(p)
      }
      return merged
    })
  }, [])

  useEffect(() => {
    if (!activityId) return
    const socket = getSocket()
    socket.on('question_started', onQuestionStarted)
    socket.on('question_ended', onQuestionEnded)
    socket.on('results_updated', onResultsUpdated)
    socket.on('participant_joined', onParticipantJoined)
    socket.on('participant_kicked', onParticipantKicked)
    socket.on('activity_started', onActivityStarted)
    socket.on('activity_completed', onActivityCompleted)
    socket.on('leaderboard_shown', onLeaderboardShown)
    return () => {
      socket.off('question_started', onQuestionStarted)
      socket.off('question_ended', onQuestionEnded)
      socket.off('results_updated', onResultsUpdated)
      socket.off('participant_joined', onParticipantJoined)
      socket.off('participant_kicked', onParticipantKicked)
      socket.off('activity_started', onActivityStarted)
      socket.off('activity_completed', onActivityCompleted)
      socket.off('leaderboard_shown', onLeaderboardShown)
    }
  }, [
    activityId,
    onQuestionStarted,
    onQuestionEnded,
    onResultsUpdated,
    onParticipantJoined,
    onParticipantKicked,
    onActivityStarted,
    onActivityCompleted,
    onLeaderboardShown,
  ])

  // -------- Actions --------
  function emitStartActivity() {
    if (!activityId) return
    const socket = getSocket()
    socket.emit('start_activity', { activityId })
  }

  function emitStartQuestion(qid: string) {
    if (!activityId) return
    const socket = getSocket()
    socket.emit('start_question', { activityId, questionId: qid })
  }

  function emitEndQuestion() {
    if (!activityId) return
    const socket = getSocket()
    socket.emit('end_question', { activityId })
  }

  function emitEndActivity() {
    if (!activityId) return
    const socket = getSocket()
    socket.emit('end_activity', { activityId })
  }

  function emitShowLeaderboard(leaderboardId: string) {
    if (!activityId) return
    const socket = getSocket()
    socket.emit('show_leaderboard', { activityId, leaderboardId })
  }

  function emitHideLeaderboard() {
    if (!activityId) return
    const socket = getSocket()
    socket.emit('hide_leaderboard', { activityId })
  }

  // Find the next item in the merged sequence after the current question.
  function getNextItemAfterQuestion(): PresentationItem | null {
    if (!activity || !current) return null
    const seq = buildPresentationSequence(activity.questions ?? [], activity.leaderboardSections ?? [])
    const currentIdx = seq.findIndex(
      (item) => item.type === 'question' && item.data.id === current.questionId,
    )
    if (currentIdx === -1) return null
    return seq[currentIdx + 1] ?? null
  }

  // Find the next item (only questions are valid — leaderboards always end
  // the round) after the currently-shown leaderboard.
  function getNextItemAfterLeaderboard(): { type: 'question'; data: QuestionDTO } | null {
    if (!activity || !leaderboardData) return null
    const seq = buildPresentationSequence(activity.questions ?? [], activity.leaderboardSections ?? [])
    const currentIdx = seq.findIndex(
      (item) => item.type === 'leaderboard' && item.data.id === leaderboardData.leaderboardId,
    )
    if (currentIdx === -1) return null
    const next = seq[currentIdx + 1]
    return next && next.type === 'question' ? next : null
  }

  // Advances the live session. Behaviour depends on the current phase:
  //  - leaderboard → start the next question (if any) and hide the leaderboard.
  //  - reveal → either show the next leaderboard (if the next item is a
  //    leaderboard) or start the next question.
  function handleNextQuestion() {
    if (phase === 'leaderboard') {
      const next = getNextItemAfterLeaderboard()
      if (next) {
        emitHideLeaderboard()
        emitStartQuestion(next.data.id)
      }
      return
    }
    // Coming from reveal — check if next is a leaderboard or a question.
    const nextItem = getNextItemAfterQuestion()
    if (!nextItem) return
    if (nextItem.type === 'leaderboard') {
      emitShowLeaderboard(nextItem.data.id)
    } else {
      emitStartQuestion(nextItem.data.id)
    }
  }

  // Whether the current item (reveal or leaderboard) is the last item in the
  // sequence — drives the "End activity" vs "Next" button choice.
  function isLastItem(): boolean {
    if (phase === 'reveal') {
      return getNextItemAfterQuestion() === null
    }
    if (phase === 'leaderboard') {
      return getNextItemAfterLeaderboard() === null
    }
    return false
  }

  function exitToDashboard() {
    setExiting(true)
    navigate('admin-dashboard')
  }

  // Open the Exit confirmation dialog.
  function openExitConfirm() {
    setConfirmExit(true)
  }

  // On confirm: broadcast reset_activity to participants, call REST /reset,
  // then go back to the dashboard. The activity ends up in PUBLISHED state
  // ("start mode") so it can be presented again immediately.
  async function handleConfirmExit() {
    if (!activityId) return
    setResetting(true)
    // 1) Notify all connected participants FIRST so they navigate back to the
    // join screen before their Participant rows are wiped by the REST call.
    try {
      const socket = getSocket()
      socket.emit('reset_activity', { activityId })
    } catch {
      /* socket emit failures are non-fatal — REST still runs */
    }
    // 2) REST: wipe participants + answers, set status -> PUBLISHED.
    try {
      await api.post(`/api/activities/${activityId}/reset`, {
        regenerateAccessCode: false,
      })
      toast.success('Activity reset to start mode')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to reset activity'
      toast.error(msg)
    } finally {
      setResetting(false)
      setConfirmExit(false)
      setExiting(true)
      navigate('admin-dashboard')
    }
  }

  async function copyAccessCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Access code copied')
    } catch {
      toast.error('Could not copy code')
    }
  }

  const remaining = useCountdown(current?.endsAt)
  const timeLow = remaining <= 5 && remaining > 0 && phase === 'question'

  const labels = useMemo(() => labelsFromLive(current), [current])
  const firstQuestionId = activity?.questions?.[0]?.id ?? null

  // -------- Render --------
  // Whether the participants sheet is available in the current phase
  // (lobby, ready, question, reveal — NOT completed/results).
  const sheetAvailable = phase !== 'completed' && phase !== 'loading'

  return (
    <div className="relative flex min-h-screen flex-col bg-stage-activity text-white">
      {/* Top bar — activity title (LEFT) + participants count button (RIGHT).
          Translucent dark glass so the pink→orange gradient shows through. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md sm:px-8">
        {/* LEFT: activity title (compact) */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-4 w-4" />
          </div>
          <p className="max-w-[50vw] truncate text-sm font-semibold leading-tight sm:max-w-[60vw]">
            {activity?.title ?? 'Loading…'}
          </p>
        </div>

        {/* RIGHT: participants count button + fullscreen toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sheetAvailable && setSheetOpen(true)}
            disabled={!sheetAvailable}
            aria-label={`View ${participantCount} participants`}
            className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              sheetAvailable
                ? 'border-white/15 bg-white/10 text-white hover:border-white/40 hover:bg-white/20'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-white/40'
            }`}
          >
            <UserRound className="h-4 w-4" />
            <span className="tabular-nums">{participantCount}</span>
            <span className="hidden text-xs text-white/60 sm:inline">
              {participantCount === 1 ? 'participant' : 'participants'}
            </span>
          </button>

          {/* Fullscreen toggle — enter/exit browser fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="group flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition-all hover:border-primary/50 hover:bg-primary/15 hover:text-primary hover:shadow-[0_0_18px_-4px_oklch(0.69_0.27_350_/_0.5)]"
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        <AnimatePresence mode="wait">
          {/* LOADING */}
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-muted-foreground"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading activity…</p>
            </motion.div>
          )}

          {/* LOBBY — interactive bubble stage */}
          {phase === 'lobby' && activity && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col"
            >
              {/* CENTER-TOP: access code in the MIDDLE, title-sized, with the
                  copy button on the same row. The joined count is no longer
                  shown here — it lives in the header button (top-right). */}
              <div className="z-20 flex flex-col items-center justify-center gap-2 px-4 pt-4 sm:pt-6">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Access code
                </span>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-4xl font-bold tracking-[0.2em] text-primary drop-shadow-[0_0_25px_hsl(var(--primary)/0.35)] sm:text-5xl md:text-6xl">
                    {activity.accessCode ?? '------'}
                  </p>
                  {activity.accessCode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyAccessCode(activity.accessCode!)}
                      aria-label="Copy access code"
                      className="h-10 w-10 text-muted-foreground hover:bg-muted hover:text-foreground sm:h-12 sm:w-12"
                    >
                      <Copy className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this code — participants join from the landing page.
                </p>
              </div>

              {/* CENTER: first user anchors the middle, others spawn around them —
                  each outside bubble has its own size + independent drift. */}
              <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                {/* Ambient soft glow behind the cluster. */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="h-[460px] w-[460px] rounded-full opacity-50 blur-3xl sm:h-[560px] sm:w-[560px]"
                    style={{
                      background:
                        'radial-gradient(circle at center, hsl(280 80% 50% / 0.42), hsl(200 80% 50% / 0.22) 60%, transparent 75%)',
                    }}
                  />
                </div>

                {/* Bubble cluster — first user pinned to center, others spawn
                    around them on a phyllotaxis (golden-angle) spiral. The
                    outer plain <div> holds the absolute position + centering
                    translate (Framer Motion's transform animations would
                    otherwise override the inline translate(-50%, -50%)).
                    Scale shrinks automatically as the cluster grows so 70+
                    participants still fit in the viewport. */}
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    transform: `translate(-50%, -50%) scale(${clusterScale})`,
                  }}
                >
                  {participants.map((p, i) => {
                    const { x, y } = phyllotaxisPosition(i)
                    // Use STABLE ID-based icon + color so the bubble matches
                    // the leaderboard + the participant's own lobby view.
                    const color = colorForParticipantById(p.id, p.displayName)
                    const Icon = getParticipantIconById(p.id)
                    const isFirst = i === 0
                    const diameter = isFirst
                      ? CENTER_BUBBLE_DIAMETER
                      : bubbleDiameter(p.displayName, i)
                    const drift = isFirst ? null : bubbleDrift(p.displayName, i)
                    return (
                      <div
                        key={p.id}
                        className="absolute"
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 220,
                            damping: 14,
                            delay: Math.min(i * 0.04, 0.6),
                          }}
                        >
                          <motion.div
                            animate={
                              drift
                                ? { x: drift.x, y: drift.y }
                                : { scale: [1, 1.04, 1] }
                            }
                            transition={
                              drift
                                ? {
                                    x: {
                                      duration: drift.duration,
                                      repeat: Infinity,
                                      ease: 'easeInOut',
                                      repeatType: 'mirror',
                                      delay: drift.delay,
                                    },
                                    y: {
                                      duration: drift.duration * 1.15,
                                      repeat: Infinity,
                                      ease: 'easeInOut',
                                      repeatType: 'mirror',
                                      delay: drift.delay + 0.3,
                                    },
                                  }
                                : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
                            }
                            className="bubble-circle flex items-center justify-center border-2 backdrop-blur-md"
                            style={{
                              width: `${diameter}px`,
                              height: `${diameter}px`,
                              borderColor: color.border,
                              background: color.soft,
                              boxShadow: `0 0 ${isFirst ? 38 : 22}px ${color.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
                              color: color.text,
                            }}
                          >
                            <Icon
                              className={
                                isFirst
                                  ? 'h-14 w-14 sm:h-16 sm:w-16'
                                  : 'h-6 w-6 sm:h-7 sm:w-7'
                              }
                              style={{ color: color.text }}
                              strokeWidth={2}
                            />
                          </motion.div>
                        </motion.div>
                      </div>
                    )
                  })}
                </div>

                {/* Hint text when nobody has joined yet. */}
                {participants.length === 0 && (
                  <div className="z-10 flex flex-col items-center gap-2 text-center">
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Waiting for participants to join…
                    </motion.p>
                    <p className="text-xs text-muted-foreground/70">
                      Share the access code above.
                    </p>
                  </div>
                )}
              </div>

              {/* BOTTOM ROW: Exit (bottom-LEFT) + Start activity (bottom-RIGHT) */}
              <div className="z-20 flex items-center justify-between p-4 sm:p-8">
                {/* Exit — bottom left. Opens the reset confirmation dialog. */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={openExitConfirm}
                    disabled={exiting || resetting}
                    className="gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive backdrop-blur-md hover:bg-destructive/20 hover:text-destructive"
                  >
                    {resetting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <LogOut className="h-5 w-5" />
                    )}
                    <span>Exit</span>
                  </Button>
                </motion.div>

                {/* Start activity — bottom right */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button
                    size="lg"
                    onClick={emitStartActivity}
                    className="gap-2 shadow-2xl shadow-primary/30"
                  >
                    <Play className="h-5 w-5" /> Start activity
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* READY (started, awaiting first question) */}
          {phase === 'ready' && activity && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-white backdrop-blur-md sm:p-10"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Check className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold sm:text-3xl">Activity is live!</h2>
              <p className="mt-2 text-white/60">
                {participantCount} {participantCount === 1 ? 'participant' : 'participants'} ready.
                Start your first question whenever you&apos;re ready.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={openExitConfirm}
                  disabled={exiting || resetting}
                  className="gap-2 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive/80"
                >
                  {resetting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <LogOut className="h-5 w-5" />
                  )}
                  <span>Exit</span>
                </Button>
                <Button
                  size="lg"
                  disabled={!firstQuestionId}
                  onClick={() => firstQuestionId && emitStartQuestion(firstQuestionId)}
                  className="gap-2"
                >
                  <Play className="h-5 w-5" /> Start question 1
                </Button>
              </div>
            </motion.div>
          )}

          {/* QUESTION phase — wrapped in `dark` so the stage-style
              (white text, glassy panels) renders correctly regardless of
              the admin-theme root. */}
          {phase === 'question' && current && (
            <motion.div
              key={`q-${current.questionId}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-[1400px] border border-white/10 bg-black/40 p-6 text-white backdrop-blur-xl sm:p-10"
            >
              {/* Header: progress + timer */}
              <div className="mb-8 flex items-center justify-between gap-3">
                <Badge
                  variant="outline"
                  className="border-white/15 bg-white/5 text-base text-white"
                >
                  Q{current.questionOrder} / {current.totalQuestions}
                </Badge>
                <motion.div
                  animate={timeLow ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.6, repeat: timeLow ? Infinity : 0 }}
                  className={`flex items-center gap-2 px-5 py-2 text-lg font-bold tabular-nums ${
                    timeLow
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  <Clock className="h-5 w-5" />
                  {formatTime(remaining)}
                </motion.div>
              </div>

              {/* Question + options — BIG: question text huge, options in 2x2 grid */}
              <div className="grid gap-8 lg:grid-cols-[1fr_minmax(320px,400px)]">
                <div>
                  <h2 className="mb-8 text-center text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                    {current.questionText}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {current.options.map((opt) => (
                      <div
                        key={opt.key}
                        className={`flex min-h-24 items-center gap-4 border-2 px-6 py-5 transition-all duration-200 hover:scale-[1.02] ${OPTION_TINTS[opt.key]}`}
                        style={{ boxShadow: OPTION_GLOWS[opt.key] }}
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-white/10 text-lg font-bold text-white">
                          {opt.key}
                        </span>
                        <span className="flex-1 text-xl font-medium text-white sm:text-2xl">
                          {opt.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live results panel */}
                <div className="border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                      Live results
                    </p>
                    <span className="text-xs text-white/50">
                      {distribution?.total ?? 0} of {participantCount} answered
                    </span>
                  </div>
                  {distribution ? (
                    <ResultBars
                      distribution={distribution}
                      labels={labels}
                      variant="compact"
                    />
                  ) : (
                    <div className="space-y-2 py-2 text-center text-sm text-white/40">
                      Waiting for responses…
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* REVEAL phase — wrapped in `dark` stage style (see question phase). */}
          {phase === 'reveal' && current && reveal && (
            <motion.div
              key={`r-${current.questionId}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-[1400px] border border-white/10 bg-black/40 p-6 text-white backdrop-blur-xl sm:p-10"
            >
              <div className="mb-8 flex items-center justify-between gap-3">
                <Badge variant="outline" className="border-white/15 bg-white/5 text-base text-white">
                  Q{current.questionOrder} / {current.totalQuestions}
                </Badge>
                <Badge className="border border-primary/40 bg-primary/20 text-base text-primary">
                  <Check className="h-4 w-4" /> Revealed
                </Badge>
              </div>

              <div className="grid gap-8 lg:grid-cols-[1fr_minmax(320px,400px)]">
                <div>
                  <h2 className="mb-8 text-center text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                    {current.questionText}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {current.options.map((opt) => {
                      const isCorrect = opt.key === reveal.correctOption
                      return (
                        <div
                          key={opt.key}
                          className={`flex min-h-24 items-center gap-4 border-2 px-6 py-5 ${
                            isCorrect
                              ? 'border-primary bg-primary/15 text-primary'
                              : 'border-white/10 bg-white/5 text-white/70'
                          }`}
                          style={isCorrect ? { boxShadow: '0 0 30px -6px oklch(0.69 0.27 350 / 0.5)' } : undefined}
                        >
                          <span
                            className={`flex h-12 w-12 shrink-0 items-center justify-center text-lg font-bold ${
                              isCorrect
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white/10 text-white/70'
                            }`}
                          >
                            {isCorrect ? <Check className="h-5 w-5" /> : opt.key}
                          </span>
                          <span className="flex-1 text-xl font-medium sm:text-2xl">
                            {opt.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                      Results
                    </p>
                    <span className="text-xs text-white/50">
                      {reveal.distribution.total} responses
                    </span>
                  </div>
                  <ResultBars
                    distribution={reveal.distribution}
                    labels={labels}
                    correctOption={reveal.correctOption}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* LEADERBOARD phase — full-width glass card with the animated
              LeaderboardChart. Trophy icon + title on top, then the chart.
              `previousEntries` is passed so the chart animates from the old
              ranking positions to the new ones (nice rank-change spring). */}
          {phase === 'leaderboard' && leaderboardData && (
            <motion.div
              key={`lb-${leaderboardData.leaderboardId}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-[1400px] border border-white/10 bg-black/40 p-6 text-white backdrop-blur-xl sm:p-10"
            >
              <div className="mb-8 flex items-center justify-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  {leaderboardData.title || 'Leaderboard'}
                </h2>
              </div>
              <LeaderboardChart
                entries={leaderboardData.entries}
                previousEntries={prevLeaderboardData?.entries}
                showScoreBreakdown
              />
            </motion.div>
          )}

          {/* COMPLETED — wrapped in `dark` stage style. */}
          {phase === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-white backdrop-blur-md sm:p-10"
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/20 text-primary"
              >
                <Trophy className="h-10 w-10" />
              </motion.div>
              <h2 className="text-3xl font-bold sm:text-5xl">Quiz complete!</h2>
              <p className="mt-3 text-white/60">
                That&apos;s a wrap. View your final results to see how everyone did.
              </p>
              <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button
                  size="lg"
                  onClick={() =>
                    activity && navigate('admin-results', { activityId: activity.id })
                  }
                >
                  <Trophy className="h-4 w-4" /> View final results
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={exitToDashboard}
                  className="text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Back to dashboard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══ BOTTOM CONTROL BAR ═══════════════════════════════════════════════
          Sticky bar at the bottom of the viewport during question & reveal
          phases. Exit button pinned to the extreme LEFT corner, Next/End
          controls pinned to the extreme RIGHT corner. Smaller buttons. */}
      {(phase === 'question' || phase === 'reveal' || phase === 'leaderboard') && (
        <div className="sticky bottom-0 z-30 border-t border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
          <div className="flex w-full items-center justify-between gap-3">
            {/* LEFT — Exit button (extreme left corner) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={openExitConfirm}
              disabled={exiting || resetting}
              className="gap-1.5 border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>Exit</span>
            </Button>

            {/* RIGHT — context-dependent:
                - question phase → End question (reveal)
                - reveal/leaderboard phase + last item → End activity
                - reveal phase + next item is a leaderboard → Leaderboard button
                - otherwise → Next question */}
            {phase === 'question' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={emitEndQuestion}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" /> End question
              </Button>
            ) : isLastItem() ? (
              <Button size="sm" variant="secondary" onClick={emitEndActivity} className="gap-1.5">
                <Flag className="h-3.5 w-3.5" /> End activity
              </Button>
            ) : phase === 'reveal' && getNextItemAfterQuestion()?.type === 'leaderboard' ? (
              <Button size="sm" onClick={handleNextQuestion} className="gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> Leaderboard
              </Button>
            ) : (
              <Button size="sm" onClick={handleNextQuestion} className="gap-1.5">
                Next question <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading skeleton overlay (when activity is loading but phase not yet determined) */}
      {!activity && phase === 'loading' && (
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <Skeleton className="h-1 w-1 rounded-full opacity-0" />
        </div>
      )}

      {/* Exit confirmation dialog — resets the activity to start mode. */}
      <AlertDialog
        open={confirmExit}
        onOpenChange={(open) => {
          if (!open && !resetting) setConfirmExit(false)
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              End activity and reset to start mode?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activity ? (
                <>
                  This will end the live session for{' '}
                  <span className="font-medium text-foreground">
                    “{activity.title}”
                  </span>{' '}
                  and remove all{' '}
                  <span className="font-medium text-foreground">
                    {participantCount}
                  </span>{' '}
                  participant
                  {participantCount === 1 ? '' : 's'} and their answers. The
                  activity will be returned to <strong>start mode</strong> (access
                  code{' '}
                  <span className="font-mono font-medium text-foreground">
                    {activity.accessCode ?? '—'}
                  </span>{' '}
                  kept) so it can be presented again.
                </>
              ) : (
                <>This will end the live session and reset the activity.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting} className="rounded-lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmExit()
              }}
              disabled={resetting}
              className="rounded-lg bg-primary text-white hover:bg-primary/90"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  End &amp; reset
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Participants sheet — accessible throughout the activity (lobby,
          ready, question, reveal) via the count button in the header. Slides
          in from the right at ~20% width; lists every participant with a
          search field + kick buttons. */}
      <ParticipantsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activityId={activityId}
        participants={participants}
        onParticipantsChange={handleParticipantsChange}
        count={participantCount}
        onCountChange={setParticipantCount}
      />
    </div>
  )
}

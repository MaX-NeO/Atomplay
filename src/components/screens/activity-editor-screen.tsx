'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { AppFooter } from '@/components/shared/app-footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  Copy,
  GripVertical,
  Loader2,
  Lock,
  Plus,
  Presentation,
  Radio,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import { MAX_PARTICIPANTS_DISPLAY } from '@/lib/participant-icons'
import type {
  ActivityDTO,
  ActivityStatus,
  LeaderboardSectionDTO,
  OptionKey,
  QuestionDTO,
} from '@/lib/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Leaderboard helpers ────────────────────────────────────────────────────

type SequenceItem =
  | { type: 'question'; data: QuestionDTO; key: string }
  | { type: 'leaderboard'; data: LeaderboardSectionDTO; key: string }

function buildSequence(
  questions: QuestionDTO[],
  leaderboards: LeaderboardSectionDTO[],
): SequenceItem[] {
  const items: SequenceItem[] = []
  const sortedQuestions = [...questions].sort((a, b) => a.questionOrder - b.questionOrder)
  for (const q of sortedQuestions) {
    items.push({ type: 'question', data: q, key: `q:${q.id}` })
    const lb = leaderboards.find((l) => l.afterQuestionOrder === q.questionOrder)
    if (lb) {
      items.push({ type: 'leaderboard', data: lb, key: `l:${lb.id}` })
    }
  }
  const defaultLb = leaderboards.find((l) => l.isDefault)
  if (defaultLb) {
    items.push({ type: 'leaderboard', data: defaultLb, key: `l:${defaultLb.id}` })
  }
  return items
}

// Sortable leaderboard card — shows a trophy illustration + "Leaderboard" text.
// Default leaderboards are NOT draggable (no drag handle, lock icon).
function SortableLeaderboardCard({
  leaderboard,
  isLast,
  onDelete,
}: {
  leaderboard: LeaderboardSectionDTO
  isLast: boolean
  onDelete: () => void
}) {
  const isDefault = leaderboard.isDefault
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `l:${leaderboard.id}`, disabled: isDefault })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex w-full items-center gap-1.5 border-2 px-1.5 py-2 transition-all ${
        isDefault
          ? 'border-primary/30 bg-primary/5'
          : 'border-primary/40 bg-primary/5 hover:border-primary/60'
      }`}
    >
      {/* Drag handle — only for non-default */}
      {isDefault ? (
        <span className="flex h-6 w-5 shrink-0 items-center justify-center text-primary/40">
          <Lock className="h-3 w-3" />
        </span>
      ) : (
        <span
          className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Trophy illustration */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary/15 text-primary">
        <Trophy className="h-3.5 w-3.5" />
      </span>

      {/* Label */}
      <div className="min-w-0 flex-1 pr-1">
        <p className="truncate text-sm font-medium leading-tight text-primary">
          {leaderboard.title || 'Leaderboard'}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
          {isDefault ? 'Final leaderboard' : isLast ? 'After last question' : 'Shows scores'}
        </p>
      </div>

      {/* Delete — only for non-default */}
      {!isDefault && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Delete leaderboard"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </span>
      )}
    </div>
  )
}

const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D']
const TIME_LIMITS = [15, 30, 45, 60, 90, 120]

const STATUS_BADGE_CLASS: Record<ActivityStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground border-border',
  PUBLISHED: 'border-chart-3/40 bg-chart-3/15 text-chart-3',
  LIVE: 'border-primary/40 bg-primary/15 text-primary',
  COMPLETED: 'border-chart-4/40 bg-chart-4/15 text-chart-4',
  ARCHIVED: 'bg-muted text-muted-foreground border-border',
}

interface QuestionFormState {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: OptionKey
  timeLimit: number
}

function toFormState(q: QuestionDTO): QuestionFormState {
  return {
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctOption: q.correctOption,
    timeLimit: q.timeLimit,
  }
}

function isFormValid(f: QuestionFormState | null): boolean {
  if (!f) return false
  return (
    f.questionText.trim().length > 0 &&
    f.optionA.trim().length > 0 &&
    f.optionB.trim().length > 0 &&
    f.optionC.trim().length > 0 &&
    f.optionD.trim().length > 0
  )
}

// Sortable question card — uses @dnd-kit/sortable for drag-and-drop reordering.
function SortableQuestionCard({
  question,
  order,
  isSelected,
  isLiveCurrent,
  onSelect,
  onDelete,
}: {
  question: QuestionDTO
  order: number
  isSelected: boolean
  isLiveCurrent: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `q:${question.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex w-full items-center gap-1.5 rounded-lg border-2 px-1.5 py-2 text-left transition-all ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
      }`}
    >
      {/* Drag handle */}
      <span
        className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>

      {/* Number badge */}
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {order}
      </span>

      {/* Question text */}
      <div className="min-w-0 flex-1 pr-1">
        <p className="truncate text-sm font-medium leading-tight">
          {question.questionText || (
            <span className="italic text-muted-foreground">Untitled question</span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
          {question.timeLimit}s · correct: {question.correctOption}
        </p>
      </div>

      {/* Delete button */}
      {!isLiveCurrent && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Delete question ${order}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </span>
      )}
    </button>
  )
}

export function ActivityEditorScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const params = useAppStore((s) => s.params)
  const activityId = params.activityId

  const [activity, setActivity] = useState<ActivityDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<QuestionFormState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<ActivityDTO | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionDTO | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchActivity = useCallback(async () => {
    if (!activityId) return
    setLoading(true)
    try {
      const res = await api.get<{ activity: ActivityDTO }>(`/api/activities/${activityId}`)
      setActivity(res.activity)
      setTitleDraft(res.activity.title)
      setSelectedId((prev) => {
        const exists = res.activity.questions?.some((q) => q.id === prev)
        if (exists) return prev
        return res.activity.questions?.[0]?.id ?? null
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load activity'
      toast.error(msg)
      if (err instanceof ApiError && err.status === 401) {
        navigate('admin-login')
      } else if (err instanceof ApiError && err.status === 404) {
        navigate('admin-dashboard')
      }
    } finally {
      setLoading(false)
    }
  }, [activityId, navigate])

  useEffect(() => {
    void fetchActivity()
  }, [fetchActivity])

  // Reorder handler — called when a drag ends. Works with the MERGED list of
  // questions + leaderboards using the unified reorder endpoint.
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !activity) return

      const questions = activity.questions ?? []
      const leaderboards = activity.leaderboardSections ?? []
      const sequence = buildSequence(questions, leaderboards)

      const oldIndex = sequence.findIndex((item) => item.key === active.id)
      const newIndex = sequence.findIndex((item) => item.key === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      // Reorder locally
      const reordered = [...sequence]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)

      // Build the items array for the unified reorder endpoint (exclude default leaderboard)
      const items = reordered
        .filter((item) => !(item.type === 'leaderboard' && item.data.isDefault))
        .map((item) => ({
          type: item.type,
          id: item.data.id,
        }))

      // Optimistically update local state
      const questionItems = items.filter((i) => i.type === 'question')
      const newQuestionOrder = questionItems.map((i, idx) => {
        const q = questions.find((qq) => qq.id === i.id)!
        return { ...q, questionOrder: idx + 1 }
      })
      // Update leaderboard afterQuestionOrder locally
      const newLeaderboards = leaderboards.map((lb) => {
        if (lb.isDefault) return lb
        const itemIndex = reordered.findIndex((r) => r.type === 'leaderboard' && r.data.id === lb.id)
        if (itemIndex === -1) return lb
        // Find the preceding question's new order
        let qOrder = 0
        for (let i = 0; i < itemIndex; i++) {
          if (reordered[i].type === 'question') qOrder++
        }
        return { ...lb, afterQuestionOrder: qOrder }
      })
      setActivity({ ...activity, questions: newQuestionOrder, leaderboardSections: newLeaderboards })

      // Persist to server
      try {
        const res = await api.patch<{
          questions: QuestionDTO[]
          leaderboardSections: LeaderboardSectionDTO[]
        }>(`/api/activities/${activityId}/items/reorder`, { items })
        setActivity((prev) =>
          prev
            ? {
                ...prev,
                questions: res.questions,
                leaderboardSections: res.leaderboardSections,
              }
            : prev,
        )
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Failed to reorder'
        toast.error(msg)
        void fetchActivity()
      }
    },
    [activity, activityId, fetchActivity],
  )

  // Sync form when selectedId changes.
  useEffect(() => {
    if (!activity || !selectedId) {
      setForm(null)
      setDirty(false)
      return
    }
    const q = activity.questions?.find((x) => x.id === selectedId)
    if (q) {
      setForm(toFormState(q))
      setDirty(false)
    }
  }, [selectedId, activity])

  const selectedQuestion = useMemo(() => {
    if (!activity || !selectedId) return null
    return activity.questions?.find((q) => q.id === selectedId) ?? null
  }, [activity, selectedId])

  function updateField<K extends keyof QuestionFormState>(field: K, value: QuestionFormState[K]) {
    if (!form) return
    setForm({ ...form, [field]: value })
    setDirty(true)
  }

  async function handleSaveQuestion() {
    if (!form || !selectedQuestion) return
    if (!isFormValid(form)) {
      toast.error('Question text and all 4 options are required')
      return
    }
    setSaving(true)
    try {
      const res = await api.patch<{ question: QuestionDTO }>(
        `/api/questions/${selectedQuestion.id}`,
        {
          questionText: form.questionText,
          optionA: form.optionA,
          optionB: form.optionB,
          optionC: form.optionC,
          optionD: form.optionD,
          correctOption: form.correctOption,
          timeLimit: form.timeLimit,
        },
      )
      setActivity((prev) =>
        prev
          ? {
              ...prev,
              questions: prev.questions?.map((q) =>
                q.id === res.question.id ? res.question : q,
              ),
            }
          : prev,
      )
      setDirty(false)
      toast.success('Question saved')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save question'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddQuestion() {
    if (!activity) return
    try {
      const res = await api.post<{ question: QuestionDTO }>(
        `/api/activities/${activity.id}/questions`,
        {
          questionText: 'New question',
          optionA: 'Option A',
          optionB: 'Option B',
          optionC: 'Option C',
          optionD: 'Option D',
          correctOption: 'A',
          timeLimit: 30,
        },
      )
      setActivity((prev) =>
        prev
          ? { ...prev, questions: [...(prev.questions ?? []), res.question] }
          : prev,
      )
      setSelectedId(res.question.id)
      toast.success('Question added')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to add question'
      toast.error(msg)
    }
  }

  async function handleAddLeaderboard() {
    if (!activity) return
    const questions = activity.questions ?? []
    if (questions.length === 0) {
      toast.error('Add at least one question first')
      return
    }
    try {
      const res = await api.post<{ leaderboard: LeaderboardSectionDTO }>(
        `/api/activities/${activity.id}/leaderboards`,
        {},
      )
      setActivity((prev) =>
        prev
          ? {
              ...prev,
              leaderboardSections: [...(prev.leaderboardSections ?? []), res.leaderboard],
            }
          : prev,
      )
      toast.success('Leaderboard added')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to add leaderboard'
      toast.error(msg)
    }
  }

  async function handleDeleteLeaderboard(leaderboardId: string) {
    if (!activity) return
    try {
      await api.delete(`/api/leaderboards/${leaderboardId}`)
      setActivity((prev) =>
        prev
          ? {
              ...prev,
              leaderboardSections: (prev.leaderboardSections ?? []).filter(
                (l) => l.id !== leaderboardId,
              ),
            }
          : prev,
      )
      toast.success('Leaderboard removed')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete leaderboard'
      toast.error(msg)
    }
  }

  async function handleDeleteQuestion() {
    if (!deletingQuestion || !activity) return
    const targetId = deletingQuestion.id
    try {
      await api.delete(`/api/questions/${targetId}`)
      const remaining = (activity.questions ?? []).filter((q) => q.id !== targetId)
      setActivity({ ...activity, questions: remaining })
      if (selectedId === targetId) {
        setSelectedId(remaining[0]?.id ?? null)
      }
      toast.success('Question deleted')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete question'
      toast.error(msg)
    } finally {
      setDeletingQuestion(null)
    }
  }

  async function handleSaveTitle() {
    if (!activity) return
    if (titleDraft.trim() === activity.title) return
    if (!titleDraft.trim()) {
      setTitleDraft(activity.title)
      return
    }
    setSavingTitle(true)
    try {
      const res = await api.patch<{ activity: ActivityDTO }>(`/api/activities/${activity.id}`, {
        title: titleDraft.trim(),
      })
      setActivity((prev) => (prev ? { ...prev, title: res.activity.title } : prev))
      toast.success('Title updated')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update title'
      toast.error(msg)
      setTitleDraft(activity.title)
    } finally {
      setSavingTitle(false)
    }
  }

  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  async function handlePublish() {
    if (!activity) return
    setPublishing(true)
    try {
      const res = await api.post<{ activity: ActivityDTO }>(
        `/api/activities/${activity.id}/publish`,
      )
      setActivity(res.activity)
      setPublishResult(res.activity)
      toast.success('Activity published!')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to publish'
      toast.error(msg)
    } finally {
      setPublishing(false)
    }
  }

  function handleTitleSubmit(e: FormEvent) {
    e.preventDefault()
    titleInputRef.current?.blur()
  }

  async function copyAccessCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Access code copied')
    } catch {
      toast.error('Could not copy code')
    }
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <Shell>
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-6 h-12 w-72" />
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </Shell>
    )
  }

  if (!activity) {
    return (
      <Shell>
        <div className="px-4 py-12 text-center sm:px-6 lg:px-8">
          <p className="text-muted-foreground">Activity not found.</p>
          <Button variant="ghost" onClick={() => navigate('admin-dashboard')} className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Button>
        </div>
      </Shell>
    )
  }

  const questionCount = activity.questions?.length ?? 0
  const formInvalid = !isFormValid(form)

  // The SELECTED question is locked only when the activity is LIVE and this
  // question is the one currently being presented (activity.currentQuestionId).
  // All other questions — and all non-LIVE activities — are fully editable.
  const isLiveQuestion =
    activity.status === 'LIVE' &&
    activity.currentQuestionId != null &&
    selectedQuestion?.id === activity.currentQuestionId

  return (
    <Shell>
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-bar backdrop-blur-md backdrop-saturate-150">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-8 lg:px-12 xl:px-16">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('admin-dashboard')}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <form className="relative min-w-0 flex-1" onSubmit={handleTitleSubmit}>
            <Input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              disabled={savingTitle}
              className="h-10 border-transparent bg-transparent px-2 text-base font-semibold hover:border-input focus-visible:border-input sm:text-lg"
              aria-label="Activity title"
            />
            {savingTitle && (
              <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </form>
          <Badge variant="outline" className={STATUS_BADGE_CLASS[activity.status]}>
            {activity.status}
          </Badge>
          {/* Recommended max participants — DISPLAY ONLY. The join API
              (`src/app/api/join/route.ts`) actually accepts up to 99, but the
              admin-facing recommendation is 80 so hosts plan their room size
              accordingly. See MAX_PARTICIPANTS_DISPLAY in
              `src/lib/participant-icons.tsx`. */}
          <Badge
            variant="outline"
            className="hidden items-center gap-1.5 border-primary/30 bg-primary/5 text-primary sm:inline-flex"
            title={`Recommended room size — the join API accepts up to 99 participants`}
          >
            <Users className="h-3.5 w-3.5" />
            Max {MAX_PARTICIPANTS_DISPLAY} participants
          </Badge>
          <div className="hidden items-center gap-2 sm:flex">
            {activity.status === 'DRAFT' ? (
              <Button
                onClick={() => setPublishOpen(true)}
                disabled={questionCount === 0 || publishing}
                size="sm"
              >
                <Sparkles className="h-4 w-4" /> Publish
              </Button>
            ) : (
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1">
                <span className="font-mono text-sm font-bold tracking-widest">
                  {activity.accessCode ?? '------'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => activity.accessCode && copyAccessCode(activity.accessCode)}
                  aria-label="Copy access code"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={activity.status === 'DRAFT'}
              onClick={() => navigate('admin-present', { activityId: activity.id })}
            >
              <Presentation className="h-4 w-4" /> Present
            </Button>
          </div>
        </div>
        {/* Mobile actions */}
        <div className="flex items-center gap-2 border-t border-border/40 px-4 py-2 sm:hidden">
          {activity.status === 'DRAFT' ? (
            <Button
              onClick={() => setPublishOpen(true)}
              disabled={questionCount === 0 || publishing}
              size="sm"
              className="flex-1"
            >
              <Sparkles className="h-4 w-4" /> Publish
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => activity.accessCode && copyAccessCode(activity.accessCode)}
            >
              <span className="font-mono font-bold tracking-widest">{activity.accessCode}</span>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={activity.status === 'DRAFT'}
            onClick={() => navigate('admin-present', { activityId: activity.id })}
          >
            <Presentation className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-6 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
          {/* Question + leaderboard list (merged, interleaved) */}
          <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Questions ({questionCount})
              </h2>
            </div>
            <div className="h-[calc(100vh-14rem)] overflow-y-auto scroll-thin pr-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={buildSequence(activity.questions ?? [], activity.leaderboardSections ?? []).map((item) => item.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {buildSequence(activity.questions ?? [], activity.leaderboardSections ?? []).map((item) => {
                      if (item.type === 'question') {
                        const q = item.data
                        const i = (activity.questions ?? []).findIndex((qq) => qq.id === q.id)
                        return (
                          <SortableQuestionCard
                            key={item.key}
                            question={q}
                            order={i + 1}
                            isSelected={q.id === selectedId}
                            isLiveCurrent={activity.status === 'LIVE' && activity.currentQuestionId === q.id}
                            onSelect={() => setSelectedId(q.id)}
                            onDelete={() => setDeletingQuestion(q)}
                          />
                        )
                      }
                      const lb = item.data
                      const sequence = buildSequence(activity.questions ?? [], activity.leaderboardSections ?? [])
                      return (
                        <SortableLeaderboardCard
                          key={item.key}
                          leaderboard={lb}
                          isLast={sequence[sequence.length - 1]?.key === item.key}
                          onDelete={() => handleDeleteLeaderboard(lb.id)}
                        />
                      )
                    })}
                    {questionCount === 0 && (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No questions yet. Add your first one!
                      </p>
                    )}
                  </div>
                </SortableContext>
              </DndContext>
              {/* Add question + Add leaderboard buttons */}
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={handleAddQuestion}
                  variant="outline"
                  className="flex-1 border-dashed"
                >
                  <Plus className="h-4 w-4" /> Question
                </Button>
                <Button
                  onClick={handleAddLeaderboard}
                  variant="outline"
                  className="flex-1 border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  disabled={questionCount === 0}
                  title={questionCount === 0 ? 'Add a question first' : 'Add a leaderboard after the last question'}
                >
                  <Trophy className="h-4 w-4" /> Leaderboard
                </Button>
              </div>
            </div>
          </aside>

          {/* Editor */}
          <section className="min-w-0">
            <AnimatePresence mode="wait">
              {selectedQuestion && form ? (
                <motion.div
                  key={selectedQuestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                            {selectedQuestion.questionOrder}
                          </span>
                          Edit question
                        </CardTitle>
                        <CardDescription>
                          {isLiveQuestion
                            ? 'This question is currently live — end it on the presentation screen before editing.'
                            : 'Keep it clear and concise. Tap a letter badge to mark the correct answer.'}
                        </CardDescription>
                      </div>
                      {isLiveQuestion ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/40 text-destructive"
                        >
                          <Radio className="mr-1 h-3 w-3" /> Live
                        </Badge>
                      ) : dirty ? (
                        <Badge
                          variant="outline"
                          className="border-primary/40 text-primary"
                        >
                          Unsaved changes
                        </Badge>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="questionText">Question</Label>
                        <Textarea
                          id="questionText"
                          value={form.questionText}
                          onChange={(e) => updateField('questionText', e.target.value)}
                          placeholder="Type your question…"
                          rows={3}
                          disabled={isLiveQuestion}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>Options</Label>
                        <div className="space-y-2">
                          {OPTION_KEYS.map((key) => {
                            const field = `option${key}` as
                              | 'optionA'
                              | 'optionB'
                              | 'optionC'
                              | 'optionD'
                            const isCorrect = form.correctOption === key
                            return (
                              <div
                                key={key}
                                className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 transition-colors ${
                                  isCorrect
                                    ? 'border-primary/60 bg-primary/5'
                                    : 'border-border bg-card'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => updateField('correctOption', key)}
                                  disabled={isLiveQuestion}
                                  aria-label={`Mark option ${key} as correct`}
                                  aria-pressed={isCorrect}
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                                    isCorrect
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary'
                                  }`}
                                >
                                  {isCorrect ? <Check className="h-4 w-4" /> : key}
                                </button>
                                <Input
                                  value={form[field]}
                                  onChange={(e) => updateField(field, e.target.value)}
                                  placeholder={`Option ${key}`}
                                  disabled={isLiveQuestion}
                                  className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
                                />
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Correct answer:{' '}
                          <span className="font-semibold text-primary">
                            {form.correctOption}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-2">
                          <Label htmlFor="timeLimit">Time limit</Label>
                          <Select
                            value={String(form.timeLimit)}
                            onValueChange={(v) => updateField('timeLimit', Number(v))}
                            disabled={isLiveQuestion}
                          >
                            <SelectTrigger id="timeLimit" className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_LIMITS.map((t) => (
                                <SelectItem key={t} value={String(t)}>
                                  {t} seconds
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isLiveQuestion && (
                            <Button
                              variant="ghost"
                              onClick={() => setDeletingQuestion(selectedQuestion)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          )}
                          <Button
                            onClick={handleSaveQuestion}
                            disabled={isLiveQuestion || formInvalid || saving || !dirty}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-card/40 text-center"
                >
                  <Sparkles className="h-10 w-10 text-muted-foreground/60" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Select a question on the left to edit, or add a new one.
                  </p>
                  <Button onClick={handleAddQuestion} variant="outline" className="mt-4">
                    <Plus className="h-4 w-4" /> Add first question
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>

      {/* Publish dialog */}
      <Dialog
        open={publishOpen}
        onOpenChange={(o) => {
          setPublishOpen(o)
          if (!o) setPublishResult(null)
        }}
      >
        <DialogContent>
          {publishResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Activity published!</DialogTitle>
                <DialogDescription>
                  Share this access code with your participants. They can join from the participant entrance.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Access code
                </p>
                <p className="mt-2 font-mono text-5xl font-bold tracking-[0.3em] text-primary">
                  {publishResult.accessCode}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    publishResult.accessCode && copyAccessCode(publishResult.accessCode)
                  }
                >
                  <Copy className="h-3.5 w-3.5" /> Copy code
                </Button>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setPublishOpen(false)}>
                  Stay in editor
                </Button>
                <Button
                  onClick={() => navigate('admin-present', { activityId: publishResult.id })}
                >
                  <Presentation className="h-4 w-4" /> Present now
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Publish activity?</DialogTitle>
                <DialogDescription>
                  This will generate a 6-digit access code so participants can join. You can still
                  edit the title, questions, and options after publishing.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Title</span>
                  <span className="truncate pl-2 text-right font-medium">{activity.title}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-medium">{questionCount}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max participants</span>
                  <span className="font-medium">{MAX_PARTICIPANTS_DISPLAY}</span>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setPublishOpen(false)} disabled={publishing}>
                  Cancel
                </Button>
                <Button onClick={handlePublish} disabled={publishing}>
                  {publishing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Publish now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete question confirm */}
      <AlertDialog
        open={!!deletingQuestion}
        onOpenChange={(o) => !o && setDeletingQuestion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete question {deletingQuestion?.questionOrder}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Remaining questions will be renumbered automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-stage-app">
      {children}
      <AppFooter />
    </div>
  )
}

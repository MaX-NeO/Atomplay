'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import { useCountdown, formatTime } from '@/hooks/use-countdown'
import { ResultBars } from '@/components/shared/result-bars'
import { AppFooter } from '@/components/shared/app-footer'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, Loader2, Radio, X } from 'lucide-react'
import type {
  ActivityStateResponse,
  AnswerDistribution,
  OptionKey,
  QuestionEndedPayload,
  QuestionStartedPayload,
  ActivityResetPayload,
  ParticipantKickedPayload,
} from '@/lib/types'

type Phase = 'connecting' | 'answering' | 'submitted' | 'reveal'

interface LiveQuestion {
  questionId: string
  questionOrder: number
  totalQuestions: number
  questionText: string
  options: { key: OptionKey; label: string }[]
  endsAt: string
}

const OPTION_COLORS: Record<
  OptionKey,
  { borderHover: string; badge: string }
> = {
  A: { borderHover: 'hover:border-chart-1/60', badge: 'bg-chart-1/15 text-chart-1' },
  B: { borderHover: 'hover:border-chart-2/60', badge: 'bg-chart-2/15 text-chart-2' },
  C: { borderHover: 'hover:border-chart-3/60', badge: 'bg-chart-3/15 text-chart-3' },
  D: { borderHover: 'hover:border-chart-4/60', badge: 'bg-chart-4/15 text-chart-4' },
}

function labelsFromQuestion(q: LiveQuestion | null): Partial<Record<OptionKey, string>> {
  if (!q) return {}
  const out: Partial<Record<OptionKey, string>> = {}
  for (const o of q.options) out[o.key] = o.label
  return out
}

export function ParticipantQuestionScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const participant = useAppStore((s) => s.participant)
  const setParticipant = useAppStore((s) => s.setParticipant)
  const [phase, setPhase] = useState<Phase>('connecting')
  const [current, setCurrent] = useState<LiveQuestion | null>(null)
  const [selected, setSelected] = useState<OptionKey | null>(null)
  const [reveal, setReveal] = useState<{
    correctOption: OptionKey
    distribution: AnswerDistribution
  } | null>(null)

  // Guard
  useEffect(() => {
    if (!participant) navigate('participant-join')
  }, [participant, navigate])

  const handleQuestionStarted = useCallback((p: QuestionStartedPayload) => {
    setCurrent({
      questionId: p.questionId,
      questionOrder: p.questionOrder,
      totalQuestions: p.totalQuestions,
      questionText: p.questionText,
      options: p.options,
      endsAt: p.endsAt,
    })
    setSelected(null)
    setReveal(null)
    setPhase('answering')
  }, [])

  const handleQuestionEnded = useCallback((p: QuestionEndedPayload) => {
    setReveal({ correctOption: p.correctOption, distribution: p.distribution })
    setPhase('reveal')
  }, [])

  // REST sync on mount
  useEffect(() => {
    if (!participant) return
    let cancelled = false
    api
      .get<ActivityStateResponse>(`/api/activities/${participant.accessCode}/state`)
      .then((state) => {
        if (cancelled) return
        if (state.status === 'COMPLETED') {
          navigate('participant-completed')
          return
        }
        if (state.status === 'PUBLISHED') {
          navigate('participant-lobby')
          return
        }
        if (state.currentQuestion) {
          const q = state.currentQuestion
          setCurrent({
            questionId: q.questionId,
            questionOrder: q.questionOrder,
            totalQuestions: q.totalQuestions,
            questionText: q.questionText,
            options: q.options,
            endsAt: q.endsAt,
          })
          setSelected(null)
          setReveal(null)
          setPhase('answering')
          return
        }
        if (state.lastReveal) {
          setReveal({
            correctOption: state.lastReveal.correctOption,
            distribution: state.lastReveal.distribution,
          })
          setPhase('reveal')
          return
        }
        // LIVE but no question / reveal — go back to lobby.
        navigate('participant-lobby')
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          navigate('participant-join')
        } else {
          setPhase('connecting')
        }
      })
    return () => {
      cancelled = true
    }
  }, [participant, navigate])

  // Socket listeners
  useEffect(() => {
    if (!participant) return
    const socket = getSocket()
    socket.emit('join_activity', {
      activityId: participant.activityId,
      sessionId: participant.sessionId,
    })
    socket.on('question_started', handleQuestionStarted)
    socket.on('question_ended', handleQuestionEnded)
    socket.on('activity_completed', () => navigate('participant-completed'))
    socket.on('activity_reset', (_p: ActivityResetPayload) => {
      // Host aborted the session and reset the activity to start mode — our
      // Participant row is being wiped, so clear the local session and send
      // the user back to the join screen.
      setParticipant(null)
      navigate('participant-join')
    })
    socket.on('participant_kicked', (p: ParticipantKickedPayload) => {
      // The host kicked us (matched by sessionId). Clear the session and
      // send the user back to the join screen.
      if (participant && p.sessionId === participant.sessionId) {
        setParticipant(null)
        navigate('participant-join')
      }
    })
    return () => {
      socket.off('question_started', handleQuestionStarted)
      socket.off('question_ended', handleQuestionEnded)
      socket.off('activity_completed')
      socket.off('activity_reset')
      socket.off('participant_kicked')
    }
  }, [participant, navigate, handleQuestionStarted, handleQuestionEnded, setParticipant])

  function submitAnswer(option: OptionKey) {
    if (!participant || !current || phase !== 'answering') return
    setSelected(option)
    setPhase('submitted')
    const socket = getSocket()
    socket.emit('submit_answer', {
      activityId: participant.activityId,
      questionId: current.questionId,
      sessionId: participant.sessionId,
      selectedOption: option,
    })
  }

  const remaining = useCountdown(current?.endsAt)
  const timeLow = remaining <= 5 && remaining > 0
  const labels = labelsFromQuestion(current)

  if (!participant) return null

  return (
    <div className="relative flex min-h-screen flex-col bg-stage-activity text-white">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* CONNECTING */}
            {phase === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 text-muted-foreground"
              >
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm">Connecting to the live quiz…</p>
              </motion.div>
            )}

            {/* ANSWERING */}
            {phase === 'answering' && current && (
              <motion.div
                key={`answering-${current.questionId}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Question {current.questionOrder} of {current.totalQuestions}
                  </p>
                  <motion.div
                    animate={timeLow ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ duration: 0.6, repeat: timeLow ? Infinity : 0 }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                      timeLow
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(remaining)}
                  </motion.div>
                </div>

                <h2 className="mb-6 text-center text-2xl font-bold leading-tight sm:text-3xl">
                  {current.questionText}
                </h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {current.options.map((opt, idx) => {
                    const colorClasses = OPTION_COLORS[opt.key]
                    return (
                      <motion.button
                        key={`${current.questionId}-${opt.key}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * idx, duration: 0.25 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => submitAnswer(opt.key)}
                        className={`flex min-h-20 items-center gap-3 rounded-2xl border-2 bg-card px-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5 ${colorClasses.borderHover}`}
                        aria-label={`Answer ${opt.key}: ${opt.label}`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold ${colorClasses.badge}`}
                        >
                          {opt.key}
                        </span>
                        <span className="flex-1 text-base font-medium">{opt.label}</span>
                      </motion.button>
                    )
                  })}
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Tap an answer to lock it in. You can only answer once.
                </p>
              </motion.div>
            )}

            {/* SUBMITTED */}
            {phase === 'submitted' && (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
                >
                  <Check className="h-10 w-10" />
                </motion.div>
                <h2 className="text-2xl font-bold">Answer locked in</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  You chose{' '}
                  <span className="font-bold text-foreground">{selected}</span>
                  {current ? ` · ${OPTION_LABEL(current, selected)}` : ''}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Waiting for the host to reveal the results…
                </p>
                <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-muted-foreground" />
              </motion.div>
            )}

            {/* REVEAL */}
            {phase === 'reveal' && (
              <motion.div
                key={`reveal-${current?.questionId ?? 'unknown'}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                {current && reveal && (
                  <>
                    <div className="mb-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Question {current.questionOrder} of {current.totalQuestions}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                        {current.questionText}
                      </h2>
                    </div>

                    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {current.options.map((opt) => {
                        const isCorrect = opt.key === reveal.correctOption
                        const isSelected = opt.key === selected
                        return (
                          <div
                            key={`${current.questionId}-${opt.key}`}
                            className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                              isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : isSelected
                                  ? 'border-amber-500/60 bg-amber-500/10'
                                  : 'border-border bg-card'
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                isCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : isSelected
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {opt.key}
                            </span>
                            <span className="flex-1 text-sm font-medium">{opt.label}</span>
                            {isCorrect && <Check className="h-5 w-5 text-emerald-500" />}
                            {isSelected && !isCorrect && (
                              <X className="h-5 w-5 text-amber-500" />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-2xl border border-border bg-card/60 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Live results
                      </p>
                      <ResultBars
                        distribution={reveal.distribution}
                        labels={labels}
                        correctOption={reveal.correctOption}
                        selectedOption={selected ?? undefined}
                      />
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for next question…
                    </div>
                  </>
                )}
                {!current && reveal && (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Radio className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold">Question ended</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Waiting for the host to start the next question…
                    </p>
                    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Results
                      </p>
                      <ResultBars
                        distribution={reveal.distribution}
                        labels={labels}
                        correctOption={reveal.correctOption}
                        selectedOption={selected ?? undefined}
                      />
                    </div>
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for next question…
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <AppFooter compact />
    </div>
  )
}

function OPTION_LABEL(q: LiveQuestion, key: OptionKey | null): string {
  if (!key) return ''
  const opt = q.options.find((o) => o.key === key)
  return opt?.label ?? ''
}

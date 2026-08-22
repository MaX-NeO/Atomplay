'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import { AppFooter } from '@/components/shared/app-footer'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { getParticipantIconById, colorForParticipantById, stableParticipantIndex, PARTICIPANT_ICONS } from '@/lib/participant-icons'
import type {
  ActivityStateResponse,
  LeaderboardShownPayload,
  ParticipantJoinedPayload,
  QuestionStartedPayload,
  ActivityCompletedPayload,
  ActivityResetPayload,
  ParticipantKickedPayload,
} from '@/lib/types'

export function ParticipantLobbyScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const participant = useAppStore((s) => s.participant)
  const setParticipant = useAppStore((s) => s.setParticipant)
  const [participantCount, setParticipantCount] = useState<number>(0)
  const [activityStarted, setActivityStarted] = useState(false)
  const [ready, setReady] = useState(false)

  // Guard: no participant session → back to join.
  useEffect(() => {
    if (!participant) {
      navigate('participant-join')
    }
  }, [participant, navigate])

  // REST sync on mount (handles reloads / late-joiners).
  useEffect(() => {
    if (!participant) return
    let cancelled = false
    api
      .get<ActivityStateResponse>(`/api/activities/${participant.accessCode}/state`)
      .then((state) => {
        if (cancelled) return
        setParticipantCount(state.participantCount)
        if (state.status === 'COMPLETED') {
          navigate('participant-completed')
          return
        }
        if (state.status === 'LIVE' && state.currentQuestion) {
          navigate('participant-question')
          return
        }
        if (state.status === 'LIVE' && state.currentLeaderboard) {
          // Host is showing a leaderboard — go to the question screen which
          // handles the leaderboard phase.
          navigate('participant-question')
          return
        }
        if (state.status === 'LIVE') {
          // Live but no question yet — activity is starting.
          setActivityStarted(true)
        }
        setReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          navigate('participant-join')
          return
        }
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [participant, navigate])

  // Socket: join the activity room and listen for state transitions.
  useEffect(() => {
    if (!participant) return
    const socket = getSocket()
    socket.emit('join_activity', {
      activityId: participant.activityId,
      sessionId: participant.sessionId,
    })

    const onQuestionStarted = (_p: QuestionStartedPayload) => {
      navigate('participant-question')
    }
    const onLeaderboardShown = (_p: LeaderboardShownPayload) => {
      // Host is showing a leaderboard — the participant-question screen has
      // a 'leaderboard' phase that will render the chart. We just navigate
      // there; the question screen will fetch the entries via its own REST
      // sync if it misses the socket payload.
      navigate('participant-question')
    }
    const onActivityCompleted = (_p: ActivityCompletedPayload) => {
      navigate('participant-completed')
    }
    const onActivityReset = (_p: ActivityResetPayload) => {
      // Host aborted the session and reset the activity to start mode — our
      // Participant row is being wiped, so clear the local session and send
      // the user back to the join screen.
      setParticipant(null)
      navigate('participant-join')
    }
    const onParticipantKicked = (p: ParticipantKickedPayload) => {
      // The host kicked us (matched by sessionId). Clear the session and
      // send the user back to the join screen with a toast.
      if (participant && p.sessionId === participant.sessionId) {
        setParticipant(null)
        navigate('participant-join')
      }
    }
    const onParticipantJoined = (p: ParticipantJoinedPayload) => {
      setParticipantCount(p.count)
    }
    const onActivityStarted = () => {
      setActivityStarted(true)
    }

    socket.on('question_started', onQuestionStarted)
    socket.on('leaderboard_shown', onLeaderboardShown)
    socket.on('activity_completed', onActivityCompleted)
    socket.on('activity_reset', onActivityReset)
    socket.on('participant_kicked', onParticipantKicked)
    socket.on('participant_joined', onParticipantJoined)
    socket.on('activity_started', onActivityStarted)

    return () => {
      socket.off('question_started', onQuestionStarted)
      socket.off('leaderboard_shown', onLeaderboardShown)
      socket.off('activity_completed', onActivityCompleted)
      socket.off('activity_reset', onActivityReset)
      socket.off('participant_kicked', onParticipantKicked)
      socket.off('participant_joined', onParticipantJoined)
      socket.off('activity_started', onActivityStarted)
    }
  }, [participant, navigate, setParticipant])

  if (!participant) return null

  // Derive the participant's stable icon + color from their DB ID.
  // This MUST match the ID used by admin views (lobby bubble, participants
  // sheet, leaderboard) — all use the DB participant ID.
  const assignedColor = colorForParticipantById(participant.participantId, participant.displayName)
  const iconIndex = stableParticipantIndex(participant.participantId)
  const AssignedIcon = PARTICIPANT_ICONS[iconIndex]

  return (
    <div className="relative flex min-h-screen flex-col bg-stage-activity text-white">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* User's assigned icon — matches the lobby bubble + leaderboard */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center border-2"
              style={{
                borderColor: assignedColor.border,
                background: assignedColor.soft,
                boxShadow: `0 0 28px -4px ${assignedColor.glow}`,
              }}
            >
              <AssignedIcon
                className="h-10 w-10"
                style={{ color: assignedColor.text }}
                strokeWidth={2}
              />
            </motion.div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              You&apos;re in!
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Hi, {participant.displayName}
            </h1>
            {participant.uoid && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/60">
                <span className="inline-flex items-center border border-white/15 bg-white/5 px-2 py-0.5 font-mono tracking-wide">
                  ID: {participant.uoid}
                </span>
              </p>
            )}
            <p className="mt-2 line-clamp-2 text-base text-white/70">
              {participant.title}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mt-8"
          >
            <Card className="border-2 border-white/15 bg-white/5 text-white shadow-lg backdrop-blur-md">
              <CardContent className="py-8">
                <div className="flex items-center justify-center gap-3 text-primary">
                  <motion.span
                    animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="h-3 w-3 bg-primary"
                  />
                  <span className="text-sm font-medium">
                    {activityStarted
                      ? 'Get ready — starting soon…'
                      : ready
                        ? 'Waiting for the host to start…'
                        : 'Connecting…'}
                  </span>
                </div>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/60">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold text-white">{participantCount}</span>
                  <span>{participantCount === 1 ? 'participant' : 'participants'} joined</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
      <AppFooter compact />
    </div>
  )
}

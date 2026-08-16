'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { AppFooter } from '@/components/shared/app-footer'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { PartyPopper, RotateCcw, Sparkles } from 'lucide-react'

export function ParticipantCompletedScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const setParticipant = useAppStore((s) => s.setParticipant)
  const participant = useAppStore((s) => s.participant)

  useEffect(() => {
    if (!participant) navigate('participant-join')
  }, [participant, navigate])

  if (!participant) return null

  function joinAnother() {
    setParticipant(null)
    navigate('participant-join')
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background bg-stage">
      {/* floating celebratory shapes */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: -10 }}
            animate={{
              opacity: [0, 1, 0],
              y: [0, 200 + i * 40],
              x: [0, (i % 2 === 0 ? 1 : -1) * (40 + i * 12)],
              rotate: [0, 90],
            }}
            transition={{
              duration: 3 + i * 0.4,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
            className="absolute h-3 w-3 rounded-full"
            style={{
              left: `${10 + i * 14}%`,
              top: `${15 + (i % 3) * 8}%`,
              background:
                i % 3 === 0
                  ? 'var(--chart-1)'
                  : i % 3 === 1
                    ? 'var(--chart-3)'
                    : 'var(--chart-2)',
            }}
          />
        ))}
      </div>

      <main className="relative flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 text-primary"
          >
            <PartyPopper className="h-10 w-10" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Quiz complete!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-3 text-base text-muted-foreground"
          >
            Thanks for playing,{' '}
            <span className="font-semibold text-foreground">{participant.displayName}</span>!
            <br />
            The host has ended this activity.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-1 text-sm text-muted-foreground/80"
          >
            {participant.title}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 space-y-2"
          >
            <Button size="lg" className="w-full" onClick={joinAnother}>
              <RotateCcw className="h-4 w-4" /> Join another quiz
            </Button>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" /> See you next time!
            </p>
          </motion.div>
        </div>
      </main>
      <AppFooter compact />
    </div>
  )
}

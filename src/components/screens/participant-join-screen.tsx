'use client'

import { useState, type FormEvent } from 'react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { AppFooter } from '@/components/shared/app-footer'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Loader2, Radio, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { JoinResponse } from '@/lib/types'

export function ParticipantJoinScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const setParticipant = useAppStore((s) => s.setParticipant)

  const [step, setStep] = useState<0 | 1>(0)
  const [accessCode, setAccessCode] = useState('')
  const [uoid, setUoid] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleCodeNext() {
    if (accessCode.length !== 6) {
      toast.error('Please enter all 6 digits')
      return
    }
    setStep(1)
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (accessCode.length !== 6) {
      toast.error('Access code is incomplete')
      setStep(0)
      return
    }
    if (!uoid.trim()) {
      toast.error('Please enter your ID')
      return
    }
    if (!displayName.trim()) {
      toast.error('Please enter your name')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post<JoinResponse>('/api/join', {
        accessCode,
        uoid: uoid.trim(),
        displayName: displayName.trim(),
      })
      setParticipant({
        sessionId: res.sessionId,
        activityId: res.activityId,
        title: res.title,
        displayName: res.displayName,
        uoid: res.uoid,
        accessCode,
      })
      navigate('participant-lobby')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to join'
      toast.error(message)
      // Go back to code step so the user can re-check the code.
      setStep(0)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-stage-activity text-white">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Radio className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Join the quiz</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the code shown on the big screen
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div
                key="step-code"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-2 border-border/60 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Step 1 of 2</CardTitle>
                    <CardDescription>Enter the 6-digit access code</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col items-center gap-3">
                      <InputOTP
                        maxLength={6}
                        value={accessCode}
                        onChange={(v) => setAccessCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                        autoFocus
                        inputMode="numeric"
                        pattern="[0-9]*"
                        containerClassName="justify-center"
                        aria-label="6-digit access code"
                      >
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-14 w-11 rounded-lg border-2 text-xl font-bold first:rounded-l-lg last:rounded-r-lg sm:w-12"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <p className="text-center text-xs text-muted-foreground">
                        Tip: you can paste the code with Ctrl/⌘+V
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={accessCode.length !== 6}
                      onClick={handleCodeNext}
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-2 border-border/60 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Step 2 of 2</CardTitle>
                    <CardDescription>Tell us who you are</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleJoin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="uoid">Player ID (UOID)</Label>
                        <Input
                          id="uoid"
                          autoFocus
                          maxLength={40}
                          placeholder="e.g. roll number or employee ID"
                          value={uoid}
                          onChange={(e) => setUoid(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Your roll number / employee ID · unique per quiz
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display name</Label>
                        <Input
                          id="displayName"
                          maxLength={30}
                          placeholder="e.g. Alex"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          {displayName.length}/30 characters · visible to the host
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStep(0)}
                          className="flex-1"
                        >
                          <ArrowLeft className="h-4 w-4" /> Back
                        </Button>
                        <Button
                          type="submit"
                          className="flex-[2]"
                          size="lg"
                          disabled={!uoid.trim() || !displayName.trim() || submitting}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Joining…
                            </>
                          ) : (
                            <>
                              Join quiz <Sparkles className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => navigate('admin-login')}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              I&apos;m a host →
            </button>
          </div>
        </div>
      </main>
      <AppFooter compact />
    </div>
  )
}

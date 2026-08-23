'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  LogIn,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { AppFooter } from '@/components/shared/app-footer'
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
import { toast } from 'sonner'
import type { AdminDTO } from '@/lib/types'

export function AdminLoginScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const setAdmin = useAppStore((s) => s.setAdmin)
  const admin = useAppStore((s) => s.admin)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-navigate if already signed in.
  useEffect(() => {
    if (admin) navigate('admin-dashboard')
  }, [admin, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      const res = await api.post<{ admin: AdminDTO }>('/api/auth/login', {
        email: email.trim(),
        password,
      })
      setAdmin(res.admin)
      toast.success(`Welcome back, ${res.admin.name}`)
      navigate('admin-dashboard')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Sign in failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-stage-activity">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-30 glass-bar backdrop-blur-md backdrop-saturate-150">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
          <button
            type="button"
            onClick={() => navigate('landing')}
            className="group flex items-center gap-2.5 text-left"
            aria-label="Back to home"
          >
            <div className="flex h-9 w-9 items-center justify-center bg-primary/15 text-primary transition-all group-hover:bg-primary/25 group-hover:shadow-[0_0_16px_-4px_oklch(0.69_0.27_350_/_0.5)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Play</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <Card className="glow-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-primary/15 text-primary shadow-[0_0_24px_-6px_oklch(0.69_0.27_350_/_0.5)]">
                <LogIn className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl">Host sign in</CardTitle>
              <CardDescription>
                Sign in to manage your live quizzes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 rounded-lg"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="h-11 w-full rounded-lg text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>Sign in</>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('landing')}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </main>

      <AppFooter />
    </div>
  )
}

'use client'

import { motion, type Variants } from 'framer-motion'
import {
  Sparkles,
  Presentation,
  Radio,
  BarChart3,
  Users,
  Zap,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { AppFooter } from '@/components/shared/app-footer'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const FEATURES = [
  {
    icon: Presentation,
    title: 'Create',
    description:
      'Draft multiple-choice questions, mark the correct answer, set per-question time limits.',
    accent: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Radio,
    title: 'Go live',
    description:
      'Publish and share a 6-digit access code. Participants join in seconds — no app needed.',
    accent: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: BarChart3,
    title: 'See results',
    description:
      'Real-time answer distribution, reveal the correct option, and review final scores.',
    accent: 'text-primary',
    bg: 'bg-primary/10',
  },
] as const

// Shared, subtle easing for a professional feel.
const EASE = [0.22, 1, 0.36, 1] as const

// Container orchestrates staggered children — keeps the entrance tidy.
const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
}

export function LandingScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const admin = useAppStore((s) => s.admin)

  return (
    <div className="flex min-h-screen flex-col bg-stage">
      {/* Top bar — logo on the left, Admin on the right */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="sticky top-0 z-30 glass-bar backdrop-blur-md backdrop-saturate-150"
      >
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
          <motion.div
            className="group flex items-center gap-2.5"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="relative flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground shadow-[0_0_20px_-4px_oklch(0.69_0.27_350_/_0.6)] transition-all group-hover:shadow-[0_0_28px_-4px_oklch(0.69_0.27_350_/_0.8)]">
              <motion.span
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <Sparkles className="h-5 w-5" />
              </motion.span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Atom Play</span>
          </motion.div>

          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ y: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Button
                size="sm"
                className="h-10 gap-2 px-4 text-sm"
                onClick={() =>
                  navigate(admin ? 'admin-dashboard' : 'admin-login')
                }
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <main className="flex-1">
        {/* Hero — full width */}
        <section
          aria-labelledby="hero-title"
          className="w-full px-4 py-20 text-center sm:px-8 sm:py-28 lg:px-12 xl:px-16"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={fadeUp}>
              <Badge
                variant="secondary"
                className="mb-6 gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-primary"
              >
                <motion.span
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <Radio className="h-3.5 w-3.5" />
                </motion.span>
                Real-time MCQ platform
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              id="hero-title"
              className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              Run live quizzes your{' '}
              <span className="gradient-text">ATOM PLAY</span>
            </motion.h1>

            {/* <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg lg:text-xl"
            >
              Create interactive multiple-choice questions, share a 6-digit code,
              and watch answers roll in live. Engaging, instant, effortless —
              built for classrooms, meetups, and teams.
            </motion.p> */}

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <motion.div
                className="w-full sm:w-auto"
                whileHover={{ y: -2 }}
                whileTap={{ y: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full px-8 text-base sm:w-auto"
                  onClick={() => navigate('participant-join')}
                >
                  <Users className="h-5 w-5" />
                  Join a quiz
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
              </motion.span>
              <span>No sign-up needed to play — just a 6-digit code.</span>
            </motion.div>
          </motion.div>
        </section>

        {/* Feature cards — full width */}
        <section
          aria-label="Features"
          className="w-full px-4 pb-20 sm:px-8 lg:px-12 xl:px-16"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid gap-6 sm:grid-cols-3"
          >
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div key={feature.title} variants={fadeUp}>
                  <motion.div
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="h-full"
                  >
                    <Card className="glow-border group h-full overflow-hidden">
                      <CardHeader>
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: -4 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className={`mb-2 flex h-12 w-12 items-center justify-center ${feature.bg} ${feature.accent} shadow-[0_0_20px_-6px_oklch(0.69_0.27_350_/_0.4)]`}
                        >
                          <Icon className="h-6 w-6" />
                        </motion.div>
                        <CardTitle className="text-xl">
                          <span className="font-mono text-xs text-primary/60 mr-2">0{i + 1}</span>
                          {feature.title}
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {feature.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent />
                    </Card>
                  </motion.div>
                </motion.div>
              )
            })}
          </motion.div>
        </section>

        {/* How it works strip — full width glass */}
        <section
          aria-label="How it works"
          className="border-y border-primary/10 bg-white/[0.02] backdrop-blur-sm"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="grid w-full gap-6 px-4 py-14 sm:grid-cols-3 sm:px-8 lg:px-12 xl:px-16"
          >
            {[
              { n: '01', t: 'Author questions', d: 'Add MCQs with 4 options and a correct answer.' },
              { n: '02', t: 'Publish & share code', d: 'Get a unique 6-digit access code for your activity.' },
              { n: '03', t: 'Go live', d: 'Open questions on your rhythm, reveal results instantly.' },
            ].map((step) => (
              <motion.div
                key={step.n}
                variants={fadeUp}
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="text-center sm:text-left"
              >
                <div className="font-mono text-2xl font-bold text-primary/80">
                  {step.n}
                </div>
                <div className="mt-2 text-base font-semibold">{step.t}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {step.d}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}

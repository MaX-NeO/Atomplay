'use client'

import { motion } from 'framer-motion'
import type { AnswerDistribution, OptionKey } from '@/lib/types'
import { Check } from 'lucide-react'

interface ResultBarsProps {
  distribution: AnswerDistribution
  /** Labels for each option: { A: 'Java Virtual Machine', ... } */
  labels: Partial<Record<OptionKey, string>>
  /** If provided, marks the correct option with a check + accent color */
  correctOption?: OptionKey
  /** If provided, marks the participant's selected option */
  selectedOption?: OptionKey
  /** Show counts vs percentages. Default: both */
  variant?: 'bars' | 'compact'
}

const OPTION_COLORS: Record<OptionKey, string> = {
  A: 'bg-chart-1',
  B: 'bg-chart-2',
  C: 'bg-chart-3',
  D: 'bg-chart-4',
}

const OPTION_TEXT_COLORS: Record<OptionKey, string> = {
  A: 'text-chart-1',
  B: 'text-chart-2',
  C: 'text-chart-3',
  D: 'text-chart-4',
}

const OPTION_BORDER_COLORS: Record<OptionKey, string> = {
  A: 'border-chart-1/40',
  B: 'border-chart-2/40',
  C: 'border-chart-3/40',
  D: 'border-chart-4/40',
}

export function ResultBars({
  distribution,
  labels,
  correctOption,
  selectedOption,
  variant = 'bars',
}: ResultBarsProps) {
  const total = distribution.total || 1
  const keys: OptionKey[] = ['A', 'B', 'C', 'D']

  return (
    <div className={variant === 'compact' ? 'space-y-2' : 'space-y-3'}>
      {keys.map((key) => {
        const count = distribution[key]
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const isCorrect = correctOption === key
        const isSelected = selectedOption === key
        const label = labels[key] ?? ''

        return (
          <div key={key} className="group">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${
                    isCorrect
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : `border-border bg-muted ${OPTION_TEXT_COLORS[key]}`
                  }`}
                >
                  {key}
                </span>
                <span className="truncate text-sm font-medium sm:text-base">{label}</span>
                {isCorrect && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Correct
                  </span>
                )}
                {isSelected && !isCorrect && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Your pick
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                <span className="text-muted-foreground">{pct}%</span>
                <span className="w-10 text-right">{count}</span>
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`h-full rounded-full ${
                  isCorrect ? 'bg-emerald-500' : OPTION_COLORS[key]
                } ${isSelected && !isCorrect ? 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-background' : ''}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        )
      })}
      <div className={`mt-2 text-center text-xs text-muted-foreground ${variant === 'compact' ? '' : 'sm:text-sm'}`}>
        {distribution.total} {distribution.total === 1 ? 'response' : 'responses'}
      </div>
    </div>
  )
}

export { OPTION_COLORS, OPTION_TEXT_COLORS, OPTION_BORDER_COLORS }

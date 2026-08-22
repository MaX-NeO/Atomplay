'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileJson,
  Download,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import type { QuestionDTO, OptionKey } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportQuestion {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: OptionKey
  timeLimit: number
}

interface ImportJson {
  questions: ImportQuestion[]
}

interface ImportQuestionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activityId: string
  onImported: (questions: QuestionDTO[]) => void
}

// ---------------------------------------------------------------------------
// Sample JSON — used for the "Download sample" button
// ---------------------------------------------------------------------------

const SAMPLE_JSON: ImportJson = {
  questions: [
    {
      questionText: 'What is the capital of France?',
      optionA: 'London',
      optionB: 'Paris',
      optionC: 'Berlin',
      optionD: 'Madrid',
      correctOption: 'B',
      timeLimit: 30,
    },
    {
      questionText: 'Which planet is known as the Red Planet?',
      optionA: 'Venus',
      optionB: 'Jupiter',
      optionC: 'Mars',
      optionD: 'Saturn',
      correctOption: 'C',
      timeLimit: 20,
    },
    {
      questionText: 'What is 8 × 7?',
      optionA: '54',
      optionB: '56',
      optionC: '64',
      optionD: '48',
      correctOption: 'B',
      timeLimit: 15,
    },
  ],
}

const VALID_OPTIONS: OptionKey[] = ['A', 'B', 'C', 'D']
const VALID_TIME_LIMITS = [15, 30, 45, 60, 90, 120]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadSampleJson() {
  const json = JSON.stringify(SAMPLE_JSON, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'atomplay-questions-sample.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function validateQuestion(q: any, index: number): { valid: boolean; error?: string; cleaned?: ImportQuestion } {
  if (!q || typeof q !== 'object') {
    return { valid: false, error: `Question ${index + 1}: not a valid object` }
  }

  const questionText = typeof q.questionText === 'string' ? q.questionText.trim() : ''
  const optionA = typeof q.optionA === 'string' ? q.optionA.trim() : ''
  const optionB = typeof q.optionB === 'string' ? q.optionB.trim() : ''
  const optionC = typeof q.optionC === 'string' ? q.optionC.trim() : ''
  const optionD = typeof q.optionD === 'string' ? q.optionD.trim() : ''

  if (!questionText) return { valid: false, error: `Question ${index + 1}: questionText is required` }
  if (!optionA) return { valid: false, error: `Question ${index + 1}: optionA is required` }
  if (!optionB) return { valid: false, error: `Question ${index + 1}: optionB is required` }
  if (!optionC) return { valid: false, error: `Question ${index + 1}: optionC is required` }
  if (!optionD) return { valid: false, error: `Question ${index + 1}: optionD is required` }

  const correctOptionRaw = typeof q.correctOption === 'string' ? q.correctOption.toUpperCase().trim() : ''
  if (!VALID_OPTIONS.includes(correctOptionRaw as OptionKey)) {
    return { valid: false, error: `Question ${index + 1}: correctOption must be A, B, C, or D` }
  }

  let timeLimit = typeof q.timeLimit === 'number' ? q.timeLimit : 30
  if (!VALID_TIME_LIMITS.includes(timeLimit)) {
    // Snap to nearest valid value, default 30
    timeLimit = 30
  }

  return {
    valid: true,
    cleaned: {
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: correctOptionRaw as OptionKey,
      timeLimit,
    },
  }
}

function parseJsonFile(text: string): { ok: true; data: ImportJson } | { ok: false; error: string } {
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch (e: any) {
    return { ok: false, error: 'Invalid JSON: ' + (e?.message || 'parse error') }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON root must be an object with a "questions" array' }
  }

  if (!Array.isArray(parsed.questions)) {
    return { ok: false, error: 'Missing or invalid "questions" array' }
  }

  if (parsed.questions.length === 0) {
    return { ok: false, error: 'The "questions" array is empty' }
  }

  return { ok: true, data: parsed as ImportJson }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportQuestionsDialog({
  open,
  onOpenChange,
  activityId,
  onImported,
}: ImportQuestionsDialogProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0) // 0=upload, 1=preview, 2=importing
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedQuestions, setParsedQuestions] = useState<ImportQuestion[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when dialog closes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setStep(0)
      setFileName(null)
      setParsedQuestions([])
      setErrors([])
      setImporting(false)
      setImportedCount(0)
      setDragOver(false)
    }
    onOpenChange(open)
  }, [onOpenChange])

  // Handle file selection
  const handleFile = useCallback((file: File) => {
    setFileName(file.name)
    setErrors([])
    setParsedQuestions([])

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const result = parseJsonFile(text)
      if (!result.ok) {
        setErrors([result.error])
        setStep(0)
        return
      }

      // Validate each question
      const valid: ImportQuestion[] = []
      const errs: string[] = []
      result.data.questions.forEach((q, i) => {
        const v = validateQuestion(q, i)
        if (v.valid && v.cleaned) {
          valid.push(v.cleaned)
        } else if (v.error) {
          errs.push(v.error)
        }
      })

      if (errs.length > 0) {
        setErrors(errs)
      }

      if (valid.length === 0) {
        setErrors((prev) => [...prev, 'No valid questions found in the file'])
        setStep(0)
        return
      }

      setParsedQuestions(valid)
      setStep(1) // Move to preview
    }
    reader.onerror = () => {
      setErrors(['Failed to read file'])
      setStep(0)
    }
    reader.readAsText(file)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  // Import all valid questions via API
  const handleImport = async () => {
    if (parsedQuestions.length === 0) return
    setStep(2)
    setImporting(true)
    setImportedCount(0)

    try {
      const created: QuestionDTO[] = []
      for (let i = 0; i < parsedQuestions.length; i++) {
        const q = parsedQuestions[i]
        const res = await api.post<{ question: QuestionDTO }>(
          `/api/activities/${activityId}/questions`,
          q,
        )
        created.push(res.question)
        setImportedCount(i + 1)
      }
      onImported(created)
      toast.success(`Imported ${created.length} question${created.length === 1 ? '' : 's'}`)
      handleOpenChange(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to import questions'
      toast.error(msg)
      setStep(1) // Back to preview on error
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Questions
          </DialogTitle>
          <DialogDescription>
            Upload a JSON file to bulk-import questions into this activity.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          <StepBadge active={step >= 0} done={step > 0} number={1} label="Upload" />
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <StepBadge active={step >= 1} done={step > 1} number={2} label="Preview" />
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <StepBadge active={step >= 2} done={false} number={3} label="Import" />
        </div>

        {/* Step 0: Upload */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Drag & drop area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-6 text-center transition-all ${
                dragOver
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <motion.div
                animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
                className="flex h-14 w-14 items-center justify-center bg-primary/10 text-primary"
              >
                <Upload className="h-7 w-7" />
              </motion.div>
              <div>
                <p className="text-sm font-medium">
                  {dragOver ? 'Drop the file here' : 'Click to upload or drag & drop'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  JSON file only · max 100 questions
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="space-y-1 border border-destructive/40 bg-destructive/10 p-3">
                {errors.map((err, i) => (
                  <p key={i} className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Download sample */}
            <div className="flex items-center justify-between border-t border-border/40 pt-4">
              <p className="text-xs text-muted-foreground">
                Need a format reference?
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSampleJson}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download sample JSON
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Preview */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {parsedQuestions.length} valid
              </Badge>
            </div>

            {errors.length > 0 && (
              <div className="space-y-1 border border-amber-500/30 bg-amber-500/10 p-2">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {errors.length} question{errors.length === 1 ? '' : 's'} skipped:
                </p>
                {errors.slice(0, 3).map((err, i) => (
                  <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400">
                    • {err}
                  </p>
                ))}
                {errors.length > 3 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    • ...and {errors.length - 3} more
                  </p>
                )}
              </div>
            )}

            {/* Question preview list */}
            <div className="max-h-[300px] overflow-y-auto scroll-thin space-y-2 pr-1">
              <AnimatePresence initial={false}>
                {parsedQuestions.map((q, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.03 }}
                    className="border border-border bg-card/50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{q.questionText}</p>
                        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                          <span className={q.correctOption === 'A' ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                            A: {q.optionA}
                          </span>
                          <span className={q.correctOption === 'B' ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                            B: {q.optionB}
                          </span>
                          <span className={q.correctOption === 'C' ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                            C: {q.optionC}
                          </span>
                          <span className={q.correctOption === 'D' ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                            D: {q.optionD}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          ⏱ {q.timeLimit}s · correct: {q.correctOption}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Step 2: Importing */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {importing ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  Importing... {importedCount} / {parsedQuestions.length}
                </p>
                <div className="h-2 w-full max-w-xs overflow-hidden bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(importedCount / parsedQuestions.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <p className="text-sm font-medium">Import complete!</p>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {step < 2 && (
          <DialogFooter className="gap-2">
            {step === 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(0)}
                disabled={importing}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {step === 0 && (
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={handleImport}
                disabled={parsedQuestions.length === 0 || importing}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" />
                Import {parsedQuestions.length} question{parsedQuestions.length === 1 ? '' : 's'}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Step badge helper
// ---------------------------------------------------------------------------

function StepBadge({
  active,
  done,
  number,
  label,
}: {
  active: boolean
  done: boolean
  number: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex h-5 w-5 items-center justify-center text-[10px] font-bold ${
          done
            ? 'bg-primary text-primary-foreground'
            : active
              ? 'border border-primary text-primary'
              : 'border border-border text-muted-foreground'
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : number}
      </div>
      <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  )
}

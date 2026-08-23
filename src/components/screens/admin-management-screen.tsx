'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  Plus,
  Edit3,
  Trash2,
  ShieldCheck,
  Shield,
  UserCog,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Mail,
  User as UserIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import { AppFooter } from '@/components/shared/app-footer'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import type { AdminDTO, AdminRole } from '@/lib/types'

type AdminRow = AdminDTO

interface FormState {
  id?: string
  name: string
  email: string
  password: string
  role: AdminRole
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'ADMIN',
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function RoleBadge({ role }: { role: AdminRole }) {
  if (role === 'SUPER_ADMIN') {
    return (
      <Badge className="gap-1.5 rounded-full border-chart-5/30 bg-chart-5/15 text-chart-5">
        <ShieldCheck className="h-3 w-3" />
        Super Admin
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1.5 rounded-full bg-muted text-muted-foreground"
    >
      <Shield className="h-3 w-3" />
      Admin
    </Badge>
  )
}

export function AdminManagementScreen() {
  const admin = useAppStore((s) => s.admin)
  const navigate = useAppStore((s) => s.navigate)
  const setAdmin = useAppStore((s) => s.setAdmin)

  const [booting, setBooting] = useState(true)
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (booting) return
    if (!admin) {
      navigate('admin-login')
      return
    }
    if (admin.role !== 'SUPER_ADMIN') {
      toast.error('Super admin access required')
      navigate('admin-dashboard')
      return
    }
    void fetchAdmins()
  }, [admin, booting, navigate])

  async function fetchAdmins() {
    setLoading(true)
    try {
      const res = await api.get<{ admins: AdminRow[] }>('/api/admins')
      setAdmins(res.admins)
    } catch {
      toast.error('Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return admins
    return admins.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q),
    )
  }, [admins, search])

  function openCreate() {
    setFormMode('create')
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(target: AdminRow) {
    setFormMode('edit')
    setForm({
      id: target.id,
      name: target.name,
      email: target.email,
      password: '',
      role: target.role,
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return
    if (formMode === 'create' && !form.password.trim()) {
      toast.error('Password is required for new admins')
      return
    }
    setSaving(true)
    try {
      if (formMode === 'create') {
        const res = await api.post<{ admin: AdminRow }>('/api/admins', {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        })
        toast.success(`Admin “${res.admin.name}” created`)
        setAdmins((prev) => [res.admin, ...prev])
      } else if (form.id) {
        const body: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
        }
        if (form.password.trim()) body.password = form.password.trim()
        const res = await api.patch<{ admin: AdminRow }>(
          `/api/admins/${form.id}`,
          body,
        )
        toast.success(`Admin “${res.admin.name}” updated`)
        setAdmins((prev) =>
          prev.map((a) => (a.id === res.admin.id ? res.admin : a)),
        )
        // If the admin edited themselves, update store too
        if (admin && admin.id === res.admin.id) setAdmin(res.admin)
      }
      setFormOpen(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Save failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/admins/${deleteTarget.id}`)
      toast.success(`Admin “${deleteTarget.name}” removed`)
      setAdmins((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Delete failed'
      toast.error(msg)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleSignOut() {
    try {
      await api.post('/api/auth/logout')
    } catch {
      /* ignore */
    }
    setAdmin(null)
    toast.success('Signed out')
    navigate('landing')
  }

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
        <AppFooter />
      </div>
    )
  }

  if (!admin || admin.role !== 'SUPER_ADMIN') return null

  return (
    <div className="flex min-h-screen flex-col bg-stage-activity">
      {/* Top nav */}
      <header className="sticky top-0 z-30 glass-bar backdrop-blur-md backdrop-saturate-150">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('admin-dashboard')}
              className="h-10 gap-1.5 px-2 text-muted-foreground hover:text-primary"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Play</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-10 w-10 rounded-xl" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 gap-2 rounded-xl px-2 pr-3"
                  aria-label="Account menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {admin.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span>{admin.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {admin.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('admin-dashboard')}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('admin-admins')}>
                  <UserCog className="h-4 w-4" />
                  Admin Management
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  variant="destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Admin management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage who can host quizzes on this platform.
            </p>
          </div>
          <Button onClick={openCreate} className="h-11 rounded-xl px-5" size="lg">
            <Plus className="h-4 w-4" />
            Add Admin
          </Button>
        </div>

        <Card className="mt-8 rounded-2xl">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">All admins</CardTitle>
                <CardDescription className="text-sm">
                  {admins.length} {admins.length === 1 ? 'admin' : 'admins'} on the platform
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-lg pl-9"
                  aria-label="Search admins"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No admins match your search.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Admin</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="pr-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const isSelf = admin.id === row.id
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                                  {initials(row.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">
                                    {row.name}
                                  </span>
                                  {isSelf && (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full border-primary/30 text-[10px] uppercase tracking-wide text-primary"
                                    >
                                      You
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {row.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={row.role} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(row.createdAt), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell className="pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(row)}
                                className="h-9 rounded-lg"
                                aria-label={`Edit ${row.name}`}
                              >
                                <Edit3 className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only sm:ml-1.5 sm:inline">
                                  Edit
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(row)}
                                disabled={isSelf}
                                className="h-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent"
                                aria-label={`Delete ${row.name}`}
                                title={isSelf ? 'You cannot delete yourself' : 'Delete admin'}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only sm:ml-1.5 sm:inline">
                                  Delete
                                </span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AppFooter />

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? 'Add a new admin' : 'Edit admin'}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? 'Create credentials for a new platform admin.'
                : 'Update name, email, role, or set a new password.'}
            </DialogDescription>
          </DialogHeader>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="adm-name">Name</Label>
              <Input
                id="adm-name"
                placeholder="Ada Lovelace"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-11 rounded-lg"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-email">Email</Label>
              <Input
                id="adm-email"
                type="email"
                placeholder="ada@quiz.local"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-pass">
                Password{' '}
                {formMode === 'edit' && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (leave blank to keep current)
                  </span>
                )}
              </Label>
              <Input
                id="adm-pass"
                type="password"
                placeholder={formMode === 'edit' ? '••••••••' : 'Set a strong password'}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v: AdminRole) =>
                  setForm((f) => ({ ...f, role: v }))
                }
              >
                <SelectTrigger className="h-11 w-full rounded-lg">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">
                    <span className="inline-flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin — host quizzes
                    </span>
                  </SelectItem>
                  <SelectItem value="SUPER_ADMIN">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Super Admin — manage admins
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.email.trim()}
              className="rounded-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : formMode === 'create' ? (
                <>
                  <Plus className="h-4 w-4" />
                  Create admin
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove admin?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Remove{' '}
                  <span className="font-medium text-foreground">
                    {deleteTarget.name}
                  </span>{' '}
                  ({deleteTarget.email}) from the platform. They will lose
                  access immediately. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

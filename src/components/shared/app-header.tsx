'use client'

import { useAppStore, type Screen } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { LogOut, LayoutDashboard, Users, Sparkles, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/shared/theme-toggle'

interface AppHeaderProps {
  /** Optional back button label & target screen */
  backTo?: { label: string; screen: Screen }
  title?: string
  /** Hide admin menu (e.g. on login screen) */
  hideMenu?: boolean
}

export function AppHeader({ backTo, title, hideMenu }: AppHeaderProps) {
  const navigate = useAppStore((s) => s.navigate)
  const admin = useAppStore((s) => s.admin)
  const setAdmin = useAppStore((s) => s.setAdmin)

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout')
      setAdmin(null)
      toast.success('Signed out')
      navigate('landing')
    } catch {
      toast.error('Sign out failed')
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(backTo.screen)}
              className="gap-1 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backTo.label}</span>
            </Button>
          )}
          <button
            onClick={() => navigate(admin ? 'admin-dashboard' : 'landing')}
            className="flex items-center gap-2 transition-opacity hover:opacity-80 shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Atom Play</span>
          </button>
          {title && (
            <>
              <span className="text-muted-foreground/60 hidden sm:inline">/</span>
              <span className="text-sm font-medium text-muted-foreground truncate max-w-[160px] sm:max-w-xs">
                {title}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle iconClassName="h-4 w-4" />

          {!hideMenu && admin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-2 sm:pr-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{admin.name}</span>
                  {admin.role === 'SUPER_ADMIN' && (
                    <Badge variant="secondary" className="hidden md:inline text-[10px]">
                      Super
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span>{admin.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{admin.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('admin-dashboard')}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                {admin.role === 'SUPER_ADMIN' && (
                  <DropdownMenuItem onClick={() => navigate('admin-admins')}>
                    <Users className="mr-2 h-4 w-4" /> Admin Management
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !hideMenu ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('admin-login')}>
              Admin sign in
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

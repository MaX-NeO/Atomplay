'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { AdminDTO } from '@/lib/types'

import { LandingScreen } from '@/components/screens/landing-screen'
import { AdminLoginScreen } from '@/components/screens/admin-login-screen'
import { ParticipantJoinScreen } from '@/components/screens/participant-join-screen'

// Lazy-load heavy screens that are only shown after navigation
const AdminDashboardScreen = dynamic(
  () => import('@/components/screens/admin-dashboard-screen').then((m) => ({ default: m.AdminDashboardScreen })),
  { ssr: false },
)
const ActivityEditorScreen = dynamic(
  () => import('@/components/screens/activity-editor-screen').then((m) => ({ default: m.ActivityEditorScreen })),
  { ssr: false },
)
const LivePresentationScreen = dynamic(
  () => import('@/components/screens/live-presentation-screen').then((m) => ({ default: m.LivePresentationScreen })),
  { ssr: false },
)
const FinalResultsScreen = dynamic(
  () => import('@/components/screens/final-results-screen').then((m) => ({ default: m.FinalResultsScreen })),
  { ssr: false },
)
const AdminManagementScreen = dynamic(
  () => import('@/components/screens/admin-management-screen').then((m) => ({ default: m.AdminManagementScreen })),
  { ssr: false },
)
const ParticipantLobbyScreen = dynamic(
  () => import('@/components/screens/participant-lobby-screen').then((m) => ({ default: m.ParticipantLobbyScreen })),
  { ssr: false },
)
const ParticipantQuestionScreen = dynamic(
  () => import('@/components/screens/participant-question-screen').then((m) => ({ default: m.ParticipantQuestionScreen })),
  { ssr: false },
)
const ParticipantCompletedScreen = dynamic(
  () => import('@/components/screens/participant-completed-screen').then((m) => ({ default: m.ParticipantCompletedScreen })),
  { ssr: false },
)

export default function Home() {
  const screen = useAppStore((s) => s.screen)
  const setAdmin = useAppStore((s) => s.setAdmin)

  // Bootstrap: check existing admin session (cookie-based).
  // We do NOT auto-navigate — just hydrate the admin so the header can show state.
  useEffect(() => {
    let cancelled = false
    api
      .get<{ admin: AdminDTO }>('/api/auth/me')
      .then((res) => {
        if (!cancelled) setAdmin(res.admin)
      })
      .catch(() => {
        if (!cancelled) setAdmin(null)
      })
    return () => {
      cancelled = true
    }
  }, [setAdmin])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {renderScreen(screen)}
    </div>
  )
}

function renderScreen(screen: string) {
  switch (screen) {
    case 'landing':
      return <LandingScreen />
    case 'admin-login':
      return <AdminLoginScreen />
    case 'admin-dashboard':
      return <AdminDashboardScreen />
    case 'admin-editor':
      return <ActivityEditorScreen />
    case 'admin-present':
      return <LivePresentationScreen />
    case 'admin-results':
      return <FinalResultsScreen />
    case 'admin-admins':
      return <AdminManagementScreen />
    case 'participant-join':
      return <ParticipantJoinScreen />
    case 'participant-lobby':
      return <ParticipantLobbyScreen />
    case 'participant-question':
      return <ParticipantQuestionScreen />
    case 'participant-completed':
      return <ParticipantCompletedScreen />
    default:
      return <LandingScreen />
  }
}

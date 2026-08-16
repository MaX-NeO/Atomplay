'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { AdminDTO } from '@/lib/types'

import { LandingScreen } from '@/components/screens/landing-screen'
import { AdminLoginScreen } from '@/components/screens/admin-login-screen'
import { AdminDashboardScreen } from '@/components/screens/admin-dashboard-screen'
import { ActivityEditorScreen } from '@/components/screens/activity-editor-screen'
import { LivePresentationScreen } from '@/components/screens/live-presentation-screen'
import { FinalResultsScreen } from '@/components/screens/final-results-screen'
import { AdminManagementScreen } from '@/components/screens/admin-management-screen'
import { ParticipantJoinScreen } from '@/components/screens/participant-join-screen'
import { ParticipantLobbyScreen } from '@/components/screens/participant-lobby-screen'
import { ParticipantQuestionScreen } from '@/components/screens/participant-question-screen'
import { ParticipantCompletedScreen } from '@/components/screens/participant-completed-screen'

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

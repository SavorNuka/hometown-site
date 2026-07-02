import { type ReactNode, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { ShareImportBanner } from '../ui/ShareImportBanner'
import { ToastStack } from '../ui/ToastStack'
import { TourProvider, useTour } from '../tour/TourProvider'
import { useAuth } from '../../hooks/useAuth'
import { usePlanStore, isImporting } from '../../stores/planStore'

function ShellInner({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { user, pushNow } = useAuth()
  const { startTour } = useTour()

  useEffect(() => {
    const storageKey = `leisurely:tour_seen${user?.id ? `:${user.id}` : ''}`
    const seen = localStorage.getItem(storageKey) || localStorage.getItem('leisurely:tour_seen')
    if (user && !seen) {
      const timer = setTimeout(() => startTour(), 900)
      return () => clearTimeout(timer)
    }
  }, [user, startTour])

  // Keep a ref so the timer callback always calls the latest pushNow without
  // needing it in the effect deps (which would restart the subscription on
  // every render since pushNow isn't memoized).
  const pushNowRef = useRef(pushNow)
  useEffect(() => { pushNowRef.current = pushNow })

  // Auto-push all local state slices to Supabase 2 s after any change so
  // collaborators can pull the latest state via their syncDown.
  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | null = null
    function schedule() {
      if (isImporting) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { timer = null; pushNowRef.current() }, 2000)
    }
    const unsubMeals   = usePlanStore.subscribe((s) => s.meals, schedule)
    const unsubPlan    = usePlanStore.subscribe((s) => s.plan, schedule)
    const unsubNotes   = usePlanStore.subscribe((s) => s.notes, schedule)
    const unsubPacking = usePlanStore.subscribe((s) => s.packingList, schedule)
    const unsubGrocery = usePlanStore.subscribe((s) => s.groceryList, schedule)
    return () => {
      unsubMeals()
      unsubPlan()
      unsubNotes()
      unsubPacking()
      unsubGrocery()
      if (timer) clearTimeout(timer)
    }
  }, [user])

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <ShareImportBanner />
      <ToastStack />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 pb-32">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <TourProvider>
      <ShellInner>{children}</ShellInner>
    </TourProvider>
  )
}

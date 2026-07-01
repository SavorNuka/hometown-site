import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Plan, Meal, GroceryItem, MealSlotKey, Note, NoteReply, PackingItem, PackingCategory, DietaryTag, AppState } from '../types'
import { mergeDayPlans } from '../lib/dateUtils'
import { aggregateIngredients } from '../lib/groceryAggregator'
import { inferCategory } from '../lib/groceryCategories'
import { savePlan, saveMeals, saveGroceryList, saveNotes, savePackingList, clearPlanFromDB, saveSnapshot } from '../lib/db'

interface PlanStore extends AppState {
  // Diet filter (client-only, not persisted)
  activeDietaryFilters: DietaryTag[]
  toggleDietaryFilter: (tag: DietaryTag) => void
  clearDietaryFilters: () => void

  // Plan actions
  setPlan: (plan: Plan) => void
  clearPlan: () => void
  updatePlanDateRange: (startDate: string, endDate: string) => void
  updatePlanName: (name: string) => void
  togglePlanVisibility: () => void

  // Meal actions
  addMeal: (meal: Meal) => void
  updateMeal: (id: string, updates: Partial<Meal>) => void
  removeMeal: (id: string) => void

  // Slot actions
  assignMealToSlot: (date: string, slot: MealSlotKey, mealId: string) => void
  clearSlot: (date: string, slot: MealSlotKey) => void

  // Grocery actions
  regenerateGroceryList: () => void
  toggleGroceryItem: (id: string) => void
  updateGroceryItemAssignment: (id: string, assignedTo: string[]) => void
  addManualGroceryItem: (name: string, quantity: number, unit: string, addedBy?: string) => void
  removeGroceryItem: (id: string) => void

  // Trip snapshot actions
  snapshotCurrent: () => Promise<void>
  saveCurrentAndSwitch: (targetState: AppState) => void

  // Note actions
  addNote: (text: string, authorName?: string, authorId?: string) => void
  removeNote: (id: string) => void
  likeNote: (id: string) => void
  addReply: (noteId: string, text: string, authorName?: string, authorId?: string) => void
  removeReply: (noteId: string, replyId: string) => void

  // Packing actions
  addPackingItem: (text: string, category: PackingCategory) => void
  togglePackingItem: (id: string) => void
  removePackingItem: (id: string) => void
  clearPackedItems: (userId?: string) => void
  updatePackingItemAssignment: (id: string, assignedTo: string[]) => void

  // Import/export
  importState: (state: Partial<AppState>) => void
  exportState: () => AppState
}

export const usePlanStore = create<PlanStore>()(
  subscribeWithSelector((set, get) => ({
    plan: null,
    meals: {},
    groceryList: [],
    notes: [],
    packingList: [],
    activeDietaryFilters: [],

    toggleDietaryFilter(tag) {
      set((s) => ({
        activeDietaryFilters: s.activeDietaryFilters.includes(tag)
          ? s.activeDietaryFilters.filter((t) => t !== tag)
          : [...s.activeDietaryFilters, tag],
      }))
    },

    clearDietaryFilters() {
      set({ activeDietaryFilters: [] })
    },

    setPlan(plan) {
      set({ plan })
    },

    clearPlan() {
      set({ plan: null, meals: {}, groceryList: [], packingList: [] })
      clearPlanFromDB()
    },

    updatePlanName(name) {
      const { plan } = get()
      if (!plan) return
      set({ plan: { ...plan, name, updatedAt: new Date().toISOString() } })
    },

    togglePlanVisibility() {
      const { plan } = get()
      if (!plan) return
      set({ plan: { ...plan, isPublic: !plan.isPublic, updatedAt: new Date().toISOString() } })
    },

    updatePlanDateRange(startDate, endDate) {
      const { plan, meals, groceryList } = get()
      if (!plan) return
      const mergedDays = mergeDayPlans(plan.days, startDate, endDate)
      const updated: Plan = { ...plan, startDate, endDate, days: mergedDays, updatedAt: new Date().toISOString() }
      const newGroceryList = aggregateIngredients(meals, mergedDays, groceryList)
      set({ plan: updated, groceryList: newGroceryList })
    },

    addMeal(meal) {
      set((s) => ({ meals: { ...s.meals, [meal.id]: meal } }))
    },

    updateMeal(id, updates) {
      const { meals } = get()
      if (!meals[id]) return
      set((s) => ({ meals: { ...s.meals, [id]: { ...meals[id], ...updates, updatedAt: new Date().toISOString() } } }))
    },

    removeMeal(id) {
      const { meals, plan } = get()
      const newMeals = { ...meals }
      delete newMeals[id]
      const newDays = plan
        ? plan.days.map((day) => ({
            ...day,
            slots: Object.fromEntries(
              Object.entries(day.slots).map(([slot, cell]) => [
                slot,
                cell.mealId === id ? { mealId: null } : cell,
              ])
            ) as Plan['days'][0]['slots'],
          }))
        : plan
      const newPlan = plan && newDays ? { ...plan, days: newDays } : plan
      set({ meals: newMeals, plan: newPlan })
      get().regenerateGroceryList()
    },

    assignMealToSlot(date, slot, mealId) {
      const { plan } = get()
      if (!plan) return
      const days = plan.days.map((day) =>
        day.date === date ? { ...day, slots: { ...day.slots, [slot]: { mealId } } } : day
      )
      set({ plan: { ...plan, days, updatedAt: new Date().toISOString() } })
      get().regenerateGroceryList()
    },

    clearSlot(date, slot) {
      const { plan } = get()
      if (!plan) return
      const days = plan.days.map((day) =>
        day.date === date ? { ...day, slots: { ...day.slots, [slot]: { mealId: null } } } : day
      )
      set({ plan: { ...plan, days, updatedAt: new Date().toISOString() } })
      get().regenerateGroceryList()
    },

    regenerateGroceryList() {
      const { meals, plan, groceryList } = get()
      if (!plan) return
      const manualItems = groceryList.filter((i) => i.manual)
      const aggregated = aggregateIngredients(meals, plan.days, groceryList)
      set({ groceryList: [...aggregated, ...manualItems] })
    },

    toggleGroceryItem(id) {
      set((s) => ({
        groceryList: s.groceryList.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        ),
      }))
    },

    updateGroceryItemAssignment(id, assignedTo) {
      set((s) => ({
        groceryList: s.groceryList.map((item) =>
          item.id === id ? { ...item, assignedTo: assignedTo.length ? assignedTo : undefined } : item
        ),
      }))
    },

    addManualGroceryItem(name, quantity, unit, addedBy) {
      const trimmedName = name.trim()
      const item: GroceryItem = {
        id: crypto.randomUUID(),
        name: trimmedName,
        quantity,
        unit: unit.trim(),
        checked: false,
        mealIds: [],
        manual: true,
        category: inferCategory(trimmedName),
        addedBy: addedBy || undefined,
      }
      set((s) => ({ groceryList: [...s.groceryList, item] }))
    },

    removeGroceryItem(id) {
      set((s) => ({ groceryList: s.groceryList.filter((i) => i.id !== id) }))
    },

    async snapshotCurrent() {
      const { plan } = get()
      if (!plan) return
      const state = get().exportState()
      await saveSnapshot(plan.id, { name: plan.name, startDate: plan.startDate, endDate: plan.endDate }, state)
    },

    saveCurrentAndSwitch(targetState) {
      const { plan } = get()
      if (plan) {
        const state = get().exportState()
        saveSnapshot(plan.id, { name: plan.name, startDate: plan.startDate, endDate: plan.endDate }, state)
      }
      get().importState(targetState)
    },

    addNote(text, authorName, authorId) {
      const note: Note = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString(), likes: 0, replies: [], authorName, authorId }
      set((s) => ({ notes: [note, ...s.notes] }))
    },

    removeNote(id) {
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
    },

    likeNote(id) {
      set((s) => ({
        notes: s.notes.map((n) => n.id === id
          ? { ...n, likes: n.likedByMe ? Math.max(0, (n.likes ?? 0) - 1) : (n.likes ?? 0) + 1, likedByMe: !n.likedByMe }
          : n)
      }))
    },

    addReply(noteId, text, authorName, authorId) {
      const reply: NoteReply = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString(), authorName, authorId }
      set((s) => ({
        notes: s.notes.map((n) => n.id === noteId ? { ...n, replies: [...(n.replies ?? []), reply] } : n)
      }))
    },

    removeReply(noteId, replyId) {
      set((s) => ({
        notes: s.notes.map((n) => n.id === noteId ? { ...n, replies: (n.replies ?? []).filter((r) => r.id !== replyId) } : n)
      }))
    },

    addPackingItem(text, category) {
      const item: PackingItem = {
        id: crypto.randomUUID(),
        text: text.trim(),
        category,
        packed: false,
        createdAt: new Date().toISOString(),
      }
      set((s) => ({ packingList: [...s.packingList, item] }))
    },

    togglePackingItem(id) {
      set((s) => ({
        packingList: s.packingList.map((item) =>
          item.id === id ? { ...item, packed: !item.packed } : item
        ),
      }))
    },

    removePackingItem(id) {
      set((s) => ({ packingList: s.packingList.filter((item) => item.id !== id) }))
    },

    clearPackedItems(userId) {
      set((s) => ({
        packingList: s.packingList.filter((item) => {
          if (!item.packed) return true
          if (!userId) return false
          return item.userId !== userId
        }),
      }))
    },

    updatePackingItemAssignment(id, assignedTo) {
      set((s) => ({
        packingList: s.packingList.map((item) =>
          item.id === id ? { ...item, assignedTo: assignedTo.length ? assignedTo : undefined } : item
        ),
      }))
    },

    importState(state) {
      const plan = state.plan
        ? { ...state.plan, days: state.plan.days ?? [] }
        : null
      isImporting = true
      _suppressDirtyMark = true
      set({
        plan,
        meals: state.meals ?? {},
        groceryList: state.groceryList ?? [],
        notes: (state.notes ?? []).map((n) => ({ ...n, likes: n.likes ?? 0, replies: n.replies ?? [] })),
        packingList: state.packingList ?? [],
      })
      _suppressDirtyMark = false
      localDirtyAt = null
      isImporting = false
    },

    exportState() {
      const { plan, meals, groceryList, notes, packingList } = get()
      return { plan, meals, groceryList, notes, packingList }
    },
  }))
)

// Tracks the most recent local mutation time. Set on any user-driven change,
// cleared by importState so syncDown knows whether local state has uncommitted
// edits that should not be overwritten by a stale remote pull.
export let localDirtyAt: string | null = null
// True while importState is running so AppShell's auto-push subscriber can
// skip scheduling a push for state changes driven by a remote sync.
export let isImporting = false
let _suppressDirtyMark = false

function _markDirty() {
  if (!_suppressDirtyMark) localDirtyAt = new Date().toISOString()
}

// Called by pushNow after a successful push so that the next syncDown can
// freely import remote state without the dirty guard blocking it.
export function resetDirtyAt(): void {
  localDirtyAt = null
}

function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: T) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

usePlanStore.subscribe((s) => s.plan, _markDirty)
usePlanStore.subscribe((s) => s.meals, _markDirty)
usePlanStore.subscribe((s) => s.groceryList, _markDirty)
usePlanStore.subscribe((s) => s.notes, _markDirty)
usePlanStore.subscribe((s) => s.packingList, _markDirty)

usePlanStore.subscribe((s) => s.plan, debounce((plan: Plan | null) => { if (plan) savePlan(plan); else clearPlanFromDB() }, 500))
usePlanStore.subscribe((s) => s.meals, debounce((meals: Record<string, Meal>) => saveMeals(meals), 500))
usePlanStore.subscribe((s) => s.groceryList, debounce((list: GroceryItem[]) => saveGroceryList(list), 500))
usePlanStore.subscribe((s) => s.notes, debounce((notes: Note[]) => saveNotes(notes), 500))
usePlanStore.subscribe((s) => s.packingList, debounce((items: PackingItem[]) => savePackingList(items), 500))

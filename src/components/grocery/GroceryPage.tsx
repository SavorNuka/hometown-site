import { useState, useMemo, useRef, type RefObject } from 'react'
import { useGroceryList } from '../../hooks/useGroceryList'
import { usePlanStore } from '../../stores/planStore'
import { useUIStore } from '../../stores/uiStore'
import { useAuth } from '../../hooks/useAuth'
import { GroceryCategoryList } from './GroceryCategoryList'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function GroceryPage() {
  const plan = usePlanStore((s) => s.plan)
  const updateGroceryItemAssignment = usePlanStore((s) => s.updateGroceryItemAssignment)
  const addManualGroceryItem = usePlanStore((s) => s.addManualGroceryItem)
  const removeGroceryItem = usePlanStore((s) => s.removeGroceryItem)
  const { groceryList, toggleGroceryItem, regenerate } = useGroceryList()
  const filterPerson = useUIStore((s) => s.groceryFilter)
  const setFilterPerson = useUIStore((s) => s.setGroceryFilter)
  const { displayName } = useAuth()
  const [filterDay, setFilterDay] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [addUnit, setAddUnit] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  function handleAddItem() {
    const name = addName.trim()
    if (!name) return
    addManualGroceryItem(name, parseFloat(addQty) || 1, addUnit.trim(), displayName ?? undefined)
    setAddName('')
    setAddQty('1')
    setAddUnit('')
    nameRef.current?.focus()
  }

  // Build a date → Set<mealId> lookup; only include days that have at least one meal
  const mealIdsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const day of plan?.days ?? []) {
      const ids = Object.values(day.slots).map((s) => s.mealId).filter(Boolean) as string[]
      if (ids.length > 0) map.set(day.date, new Set(ids))
    }
    return map
  }, [plan?.days])

  const daysWithMeals = useMemo(() => Array.from(mealIdsByDate.keys()), [mealIdsByDate])

  const allAssignees = useMemo(() => {
    const names = new Set<string>()
    for (const item of groceryList) {
      for (const name of item.assignedTo ?? []) names.add(name)
    }
    return Array.from(names).sort()
  }, [groceryList])

  const visibleItems = useMemo(() => {
    let items = groceryList
    if (filterDay) {
      const dayMeals = mealIdsByDate.get(filterDay) ?? new Set()
      items = items.filter((i) =>
        // Manual items have no mealIds — always show them
        i.manual || i.mealIds.length === 0 || i.mealIds.some((id) => dayMeals.has(id))
      )
    }
    if (filterPerson) {
      items = items.filter((i) => i.manual || (i.assignedTo ?? []).includes(filterPerson))
    }
    return items
  }, [groceryList, filterDay, filterPerson, mealIdsByDate])

  if (!plan) {
    return (
      <EmptyState
        title="No trip yet"
        description="Create a trip plan first and add meals to generate your grocery list."
      />
    )
  }

  if (groceryList.length === 0) {
    return (
      <div className="py-6 space-y-4">
        <EmptyState
          title="No ingredients yet"
          description="Add meals with ingredients in your plan and they'll appear here."
          action={{ label: 'Refresh list', onClick: regenerate }}
        />
        <AddItemForm
          name={addName} qty={addQty} unit={addUnit}
          nameRef={nameRef}
          onName={setAddName} onQty={setAddQty} onUnit={setAddUnit}
          onAdd={handleAddItem}
        />
      </div>
    )
  }

  const checkedCount = groceryList.filter((i) => i.checked).length

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-semibold text-olive">Grocery List</h2>
          <p className="text-xs text-olive/50">
            {checkedCount}/{groceryList.length} items checked
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={regenerate}>
          Refresh
        </Button>
      </div>

      {/* Filter by day */}
      {daysWithMeals.length >= 1 && (
        <div className="flex gap-2 items-center overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-xs text-olive/50 shrink-0">Day:</span>
          {daysWithMeals.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => setFilterDay(filterDay === date ? null : date)}
              className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors shrink-0 ${
                filterDay === date
                  ? 'bg-olive text-white'
                  : 'bg-olive/10 text-olive hover:bg-olive/20'
              }`}
            >
              {formatDayLabel(date)}
            </button>
          ))}
          {filterDay && (
            <button
              type="button"
              onClick={() => setFilterDay(null)}
              className="text-xs text-olive/40 hover:text-olive transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Filter by person */}
      {allAssignees.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-olive/50">Filter:</span>
          {allAssignees.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilterPerson(filterPerson === name ? null : name)}
              className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
                filterPerson === name
                  ? 'bg-sage text-white'
                  : 'bg-sage/15 text-olive hover:bg-sage/25'
              }`}
            >
              {name}
            </button>
          ))}
          {filterPerson && (
            <button
              type="button"
              onClick={() => setFilterPerson(null)}
              className="text-xs text-olive/40 hover:text-olive transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <GroceryCategoryList
        items={visibleItems}
        onToggle={toggleGroceryItem}
        onAssign={updateGroceryItemAssignment}
        onRemove={removeGroceryItem}
      />

      <AddItemForm
        name={addName} qty={addQty} unit={addUnit}
        nameRef={nameRef}
        onName={setAddName} onQty={setAddQty} onUnit={setAddUnit}
        onAdd={handleAddItem}
      />
    </div>
  )
}

interface AddItemFormProps {
  name: string
  qty: string
  unit: string
  nameRef: RefObject<HTMLInputElement | null>
  onName: (v: string) => void
  onQty: (v: string) => void
  onUnit: (v: string) => void
  onAdd: () => void
}

function AddItemForm({ name, qty, unit, nameRef, onName, onQty, onUnit, onAdd }: AddItemFormProps) {
  return (
    <div className="bg-white rounded-card shadow-card p-3">
      <p className="text-xs font-semibold text-olive/40 uppercase tracking-wide mb-2">Add item</p>
      <div className="flex gap-2 items-end">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-olive/50 mb-0.5 block">Name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onAdd() }}
            placeholder="e.g. olive oil"
            className="w-full rounded-lg border border-olive/20 bg-cream/50 px-2.5 py-1.5 text-sm text-olive placeholder:text-olive/30 focus:border-sage focus:ring-1 focus:ring-sage focus:outline-none"
          />
        </div>
        <div className="w-16 shrink-0">
          <label className="text-xs text-olive/50 mb-0.5 block">Qty</label>
          <input
            type="number"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => onQty(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onAdd() }}
            className="w-full rounded-lg border border-olive/20 bg-cream/50 px-2.5 py-1.5 text-sm text-olive focus:border-sage focus:ring-1 focus:ring-sage focus:outline-none"
          />
        </div>
        <div className="w-20 shrink-0">
          <label className="text-xs text-olive/50 mb-0.5 block">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => onUnit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onAdd() }}
            placeholder="g, cup…"
            className="w-full rounded-lg border border-olive/20 bg-cream/50 px-2.5 py-1.5 text-sm text-olive placeholder:text-olive/30 focus:border-sage focus:ring-1 focus:ring-sage focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!name.trim()}
          className="shrink-0 rounded-lg bg-sage px-3 py-1.5 text-sm font-medium text-white hover:bg-sage/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

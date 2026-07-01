import { usePlanStore } from '../stores/planStore'
import { useAuth } from './useAuth'
import type { PackingCategory } from '../types'

export function usePacking() {
  const packingList = usePlanStore((s) => s.packingList)
  const addPackingItem = usePlanStore((s) => s.addPackingItem)
  const togglePackingItem = usePlanStore((s) => s.togglePackingItem)
  const removePackingItem = usePlanStore((s) => s.removePackingItem)
  const _clearPackedItems = usePlanStore((s) => s.clearPackedItems)
  const { user } = useAuth()

  const packedCount = packingList.filter((i) => i.packed).length

  function byCategory(category: PackingCategory) {
    return packingList.filter((i) => i.category === category)
  }

  function clearPackedItems() {
    _clearPackedItems(user?.id)
  }

  return { packingList, packedCount, byCategory, addPackingItem, togglePackingItem, removePackingItem, clearPackedItems }
}

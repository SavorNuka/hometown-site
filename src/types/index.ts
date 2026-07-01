export type AllergyTag = `allergy:${string}`

export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'nut-free'
  | 'halal'
  | 'kosher'
  | AllergyTag

export const PRESET_DIETARY_TAGS: Exclude<DietaryTag, AllergyTag>[] = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'halal',
  'kosher',
]

export type MealSlotKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export const MEAL_SLOT_LABELS: Record<MealSlotKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

export type GroceryCategory =
  | 'produce' | 'dairy' | 'meat' | 'bakery' | 'dry-goods'
  | 'frozen' | 'beverages' | 'condiments' | 'household' | 'other'

export const GROCERY_CATEGORY_ORDER: GroceryCategory[] = [
  'produce', 'dairy', 'meat', 'bakery', 'dry-goods',
  'frozen', 'beverages', 'condiments', 'household', 'other',
]

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy & Eggs',
  meat: 'Meat & Seafood',
  bakery: 'Bakery',
  'dry-goods': 'Dry Goods & Canned',
  frozen: 'Frozen',
  beverages: 'Beverages',
  condiments: 'Condiments & Spices',
  household: 'Household',
  other: 'Other',
}

export const GROCERY_CATEGORY_EMOJI: Record<GroceryCategory, string> = {
  produce: '🥦',
  dairy: '🧀',
  meat: '🥩',
  bakery: '🍞',
  'dry-goods': '🌾',
  frozen: '❄️',
  beverages: '🥤',
  condiments: '🫙',
  household: '🧹',
  other: '📦',
}

export interface GroceryItem {
  id: string
  name: string
  quantity: number
  unit: string
  checked: boolean
  mealIds: string[]
  assignedTo?: string[]
  addedBy?: string
  manual?: true
  category?: GroceryCategory
}

export interface Meal {
  id: string
  name: string
  notes: string
  servings: number
  scaleToServings?: boolean
  dietaryTags: DietaryTag[]
  ingredients: GroceryItem[]
  assignedTo?: string[]
  createdAt: string
  updatedAt: string
}

export interface MealSlot {
  mealId: string | null
}

export interface DayPlan {
  date: string
  slots: Record<MealSlotKey, MealSlot>
}

export interface Plan {
  id: string
  name: string
  startDate: string
  endDate: string
  days: DayPlan[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface NoteReply {
  id: string
  text: string
  createdAt: string
  authorName?: string
  authorId?: string
}

export interface Note {
  id: string
  text: string
  createdAt: string
  likes: number
  likedByMe?: boolean
  replies: NoteReply[]
  authorName?: string
  authorId?: string
}

export type PackingCategory = 'clothes' | 'toiletries' | 'documents' | 'kitchen' | 'misc'

export const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  clothes: 'Clothes',
  toiletries: 'Toiletries',
  documents: 'Documents',
  kitchen: 'Kitchen & Food',
  misc: 'Misc',
}

export const PACKING_CATEGORY_EMOJI: Record<PackingCategory, string> = {
  clothes: '👕',
  toiletries: '🧴',
  documents: '📄',
  kitchen: '🍳',
  misc: '📦',
}

export interface PackingItem {
  id: string
  userId?: string
  text: string
  category: PackingCategory
  packed: boolean
  createdAt: string
  assignedTo?: string[]
}

export interface AppState {
  plan: Plan | null
  meals: Record<string, Meal>
  groceryList: GroceryItem[]
  notes: Note[]
  packingList: PackingItem[]
}

export interface TripStub {
  planId: string
  name: string
  startDate: string
  endDate: string
  savedAt: string
}

// Recipe (from local JSON database)
export interface Recipe {
  id: string
  name: string
  description: string
  servings: number
  dietaryTags: DietaryTag[]
  ingredients: Omit<GroceryItem, 'checked' | 'mealIds'>[]
}

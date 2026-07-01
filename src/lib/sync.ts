import { supabase, isConfigured } from './supabase'
import type { AppState, Plan, GroceryItem, PackingCategory, PackingItem } from '../types'

type RealtimeUnsub = () => void

// ── Push local state → Supabase ─────────────────────────────────────────────

export async function pushPlan(
  state: AppState,
  userId: string
): Promise<{ error: string | null }> {
  if (!isConfigured() || !supabase || !state.plan) return { error: null }
  const { plan, meals, groceryList } = state

  const isOwner = !plan.ownerId || plan.ownerId === userId
  if (isOwner) {
    const { error: planError } = await supabase.from('plans').upsert({
      id: plan.id,
      user_id: userId,
      name: plan.name,
      start_date: plan.startDate,
      end_date: plan.endDate,
      is_public: plan.isPublic,
      days: plan.days,
      updated_at: plan.updatedAt,
      created_at: plan.createdAt,
    })
    if (planError) { console.error('plan upsert failed', planError); return { error: planError.message } }
  } else {
    const { error: daysError } = await supabase
      .from('plans')
      .update({ days: plan.days, updated_at: plan.updatedAt })
      .eq('id', plan.id)
    if (daysError) console.error('plan days update failed (collab)', daysError)
  }

  const mealRows = Object.values(meals).map((m) => ({
    id: m.id,
    plan_id: plan.id,
    user_id: userId,
    data: m,
    updated_at: m.updatedAt,
    created_at: m.createdAt,
  }))
  if (mealRows.length > 0) {
    const { error: mealError } = await supabase.from('meals').upsert(mealRows)
    if (mealError) { console.error('meal upsert failed', mealError); return { error: mealError.message } }
  }

  await supabase.from('grocery_items').delete().eq('plan_id', plan.id)
  const groceryRows = groceryList.map((g) => ({
    id: crypto.randomUUID(),
    plan_id: plan.id,
    user_id: userId,
    data: g,
  }))
  if (groceryRows.length > 0) {
    const { error: groceryError } = await supabase.from('grocery_items').insert(groceryRows)
    if (groceryError) console.error('grocery insert failed', groceryError)
  }

  return { error: null }
}

export async function deletePlan(planId: string): Promise<void> {
  if (!isConfigured() || !supabase) return
  await supabase.from('plans').delete().eq('id', planId)
}

export async function pushNotes(
  notes: AppState['notes'],
  userId: string,
  planId?: string,
  displayName?: string
): Promise<void> {
  if (!isConfigured() || !supabase) return

  const ownNotes = notes.filter((n) => !n.authorId || n.authorId === userId)

  if (ownNotes.length > 0) {
    const rows = ownNotes.map((n) => ({
      id: n.id,
      user_id: userId,
      plan_id: planId ?? null,
      text: n.text,
      created_at: n.createdAt,
      author_name: n.authorName ?? displayName ?? null,
    }))
    await supabase.from('notes').upsert(rows, { onConflict: 'id' })
  }

  if (planId) {
    const keepIds = ownNotes.map((n) => n.id)
    const deleteQuery = supabase.from('notes').delete().eq('user_id', userId).eq('plan_id', planId)
    if (keepIds.length > 0) {
      await deleteQuery.not('id', 'in', `(${keepIds.join(',')})`)
    } else {
      await deleteQuery
    }
  }

  const ownNoteIds = ownNotes.map((n) => n.id)
  if (ownNoteIds.length > 0) {
    const replyRows = ownNotes.flatMap((n) =>
      (n.replies ?? [])
        .filter((r) => !r.authorId || r.authorId === userId)
        .map((r) => ({
          id: r.id,
          note_id: n.id,
          user_id: userId,
          text: r.text,
          created_at: r.createdAt,
          author_name: r.authorName ?? displayName ?? null,
        }))
    )
    if (replyRows.length > 0) {
      await supabase.from('note_replies').upsert(replyRows, { onConflict: 'id' })
    }
    const keepReplyIds = replyRows.map((r) => r.id)
    const deleteRepliesQuery = supabase.from('note_replies').delete().eq('user_id', userId).in('note_id', ownNoteIds)
    if (keepReplyIds.length > 0) {
      await deleteRepliesQuery.not('id', 'in', `(${keepReplyIds.join(',')})`)
    } else {
      await deleteRepliesQuery
    }
  }
}

export async function pushPackingList(
  items: PackingItem[],
  planId: string,
  userId: string
): Promise<void> {
  if (!isConfigured() || !supabase) return
  await supabase.from('packing_items').delete().eq('plan_id', planId).eq('user_id', userId)
  const rows = items
    .filter((p) => !p.userId || p.userId === userId)
    .map((p) => ({
      id: p.id,
      plan_id: planId,
      user_id: userId,
      text: p.text,
      category: p.category,
      packed: p.packed,
      created_at: p.createdAt,
      assigned_to: p.assignedTo ?? null,
    }))
  if (rows.length > 0) {
    await supabase.from('packing_items').insert(rows)
  }
}

// ── Note likes ──────────────────────────────────────────────────────────────────

export async function toggleNoteLike(
  noteId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  if (!isConfigured() || !supabase) return
  if (currentlyLiked) {
    await supabase.from('note_likes').delete().eq('note_id', noteId).eq('user_id', userId)
  } else {
    await supabase.from('note_likes').insert({ note_id: noteId, user_id: userId })
  }
}

// ── Plan collaboration ──────────────────────────────────────────────────────

export async function addCollaborator(
  planId: string,
  targetUserId: string,
  invitedBy: string,
  role: 'editor' | 'viewer' = 'editor'
): Promise<{ error: string | null }> {
  if (!isConfigured() || !supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('plan_collaborators').upsert({
    plan_id: planId,
    user_id: targetUserId,
    invited_by: invitedBy,
    role,
  })
  return { error: error?.message ?? null }
}

export async function removeCollaborator(planId: string, targetUserId: string): Promise<void> {
  if (!isConfigured() || !supabase) return
  await supabase.from('plan_collaborators').delete().eq('plan_id', planId).eq('user_id', targetUserId)
}

export async function getCollaborators(
  planId: string
): Promise<Array<{ userId: string; role: string; joinedAt: string }>> {
  if (!isConfigured() || !supabase) return []
  const { data } = await supabase
    .from('plan_collaborators')
    .select('user_id, role, joined_at')
    .eq('plan_id', planId)
  return (data ?? []).map((r: { user_id: string; role: string; joined_at: string }) => ({
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
  }))
}

// ── Pull Supabase → local state ────────────────────────────────────────────────

export async function pullFromSupabase(
  userId: string,
  planId?: string
): Promise<Partial<AppState & { packingList: PackingItem[] }> | null> {
  if (!isConfigured() || !supabase) return null

  let planRow: Record<string, unknown>

  if (planId) {
    // Load a specific plan by ID — used immediately after accepting a collaborative invite
    const res = await supabase.from('plans').select('*').eq('id', planId).single()
    if (res.error || !res.data) return null
    planRow = res.data as Record<string, unknown>
  } else {
    // Try owned plan first; fall back to most-recently-joined collaborative plan
    const ownedRes = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!ownedRes.error && ownedRes.data?.length) {
      planRow = ownedRes.data[0] as Record<string, unknown>
    } else {
      const collabRes = await supabase
        .from('plan_collaborators')
        .select('plan_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1)

      if (collabRes.error || !collabRes.data?.length) return null

      const planFetch = await supabase
        .from('plans')
        .select('*')
        .eq('id', collabRes.data[0].plan_id)
        .single()

      if (planFetch.error || !planFetch.data) return null
      planRow = planFetch.data as Record<string, unknown>
    }
  }

  const [mealsRes, groceryRes, notesRes] = await Promise.all([
    supabase.from('meals').select('*').eq('plan_id', planRow.id as string),
    supabase.from('grocery_items').select('*').eq('plan_id', planRow.id as string),
    supabase.from('notes').select('*').eq('plan_id', planRow.id as string).order('created_at', { ascending: false }),
  ])

  const pr = planRow as { id: string; user_id: string; name: string; start_date: string; end_date: string; is_public: boolean; days: Plan['days']; created_at: string; updated_at: string }
  const plan = {
    id: pr.id,
    ownerId: pr.user_id,
    name: pr.name,
    startDate: pr.start_date,
    endDate: pr.end_date,
    isPublic: pr.is_public,
    days: pr.days,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
  }

  const meals: AppState['meals'] = {}
  for (const row of mealsRes.data ?? []) {
    meals[row.data.id] = row.data
  }

  const groceryList = (groceryRes.data ?? []).map((r: { data: GroceryItem }) => r.data)

  // Pull replies and likes for these notes in parallel
  const noteIds = (notesRes.data ?? []).map((r: { id: string }) => r.id)
  const [repliesRes, likesRes] = await Promise.all([
    noteIds.length > 0
      ? supabase.from('note_replies').select('*').in('note_id', noteIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
    noteIds.length > 0
      ? supabase.from('note_likes').select('note_id, user_id').in('note_id', noteIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const repliesByNoteId: Record<string, Array<{ id: string; text: string; createdAt: string; authorName?: string; authorId?: string }>> = {}
  for (const r of repliesRes.data ?? []) {
    const row = r as { id: string; note_id: string; user_id: string; text: string; created_at: string; author_name?: string }
    if (!repliesByNoteId[row.note_id]) repliesByNoteId[row.note_id] = []
    repliesByNoteId[row.note_id].push({ id: row.id, text: row.text, createdAt: row.created_at, authorName: row.author_name ?? undefined, authorId: row.user_id })
  }

  const likeCountByNoteId: Record<string, number> = {}
  const likedByMeSet = new Set<string>()
  for (const r of likesRes.data ?? []) {
    const row = r as { note_id: string; user_id: string }
    likeCountByNoteId[row.note_id] = (likeCountByNoteId[row.note_id] ?? 0) + 1
    if (row.user_id === userId) likedByMeSet.add(row.note_id)
  }

  const notes = (notesRes.data ?? []).map((r: { id: string; user_id: string; text: string; created_at: string; author_name?: string }) => ({
    id: r.id,
    text: r.text,
    createdAt: r.created_at,
    likes: likeCountByNoteId[r.id] ?? 0,
    likedByMe: likedByMeSet.has(r.id),
    replies: repliesByNoteId[r.id] ?? [],
    authorName: r.author_name ?? undefined,
    authorId: r.user_id,
  }))

  const packingRes = await supabase
    .from('packing_items')
    .select('*')
    .eq('plan_id', planRow.id as string)
    .order('created_at', { ascending: true })

  const packingList = (packingRes.data ?? []).map((r: {
    id: string; user_id: string; text: string; category: string; packed: boolean; created_at: string; assigned_to?: string[] | null
  }) => ({
    id: r.id,
    userId: r.user_id,
    text: r.text,
    category: r.category as PackingCategory,
    packed: r.packed,
    createdAt: r.created_at,
    assignedTo: r.assigned_to ?? undefined,
  }))

  return { plan, meals, groceryList, notes, packingList }
}

// ── Invites ────────────────────────────────────────────────────────────────────────

export async function sendInvites(
  planId: string,
  planName: string,
  inviterName: string,
  emails: string[],
  planDates?: { startDate: string; endDate: string }
): Promise<{ error: string | null }> {
  if (!isConfigured() || !supabase) return { error: 'Supabase not configured' }
  const { data, error } = await supabase.functions.invoke('invite-collaborator', {
    body: { planId, planName, inviterName, emails, ...planDates },
  })
  if (error) return { error: error.message }
  const failed = ((data?.results ?? []) as { email: string; error?: string }[]).filter((r) => r.error)
  if (failed.length > 0) {
    const detail = failed[0].error ?? 'unknown error'
    return { error: `Resend rejected ${failed[0].email}: ${detail}` }
  }
  return { error: null }
}

export async function processInvite(
  token: string,
  userId: string
): Promise<{ planId: string | null; error: string | null }> {
  if (!isConfigured() || !supabase) return { planId: null, error: 'Supabase not configured' }

  const { data: invite, error: fetchError } = await supabase
    .from('plan_invites')
    .select('id, plan_id, expires_at, accepted_at')
    .eq('token', token)
    .single()

  if (fetchError || !invite) return { planId: null, error: 'Invite not found or already used.' }
  if (invite.accepted_at) return { planId: null, error: 'This invite has already been accepted.' }
  if (new Date(invite.expires_at) < new Date()) return { planId: null, error: 'This invite has expired.' }

  const { error: upsertError } = await supabase.from('plan_collaborators').upsert({
    plan_id: invite.plan_id,
    user_id: userId,
    invited_by: null,
    role: 'editor',
  })

  if (upsertError) {
    return { planId: null, error: 'Could not join the trip. The invite may have already been used or the trip no longer exists.' }
  }

  await supabase
    .from('plan_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return { planId: invite.plan_id, error: null }
}

// ── Realtime subscriptions ──────────────────────────────────────────────────────────

export function subscribeToRealtime(
  planId: string,
  _userId: string,
  onPlanChange: () => void,
  onMealChange: () => void,
  onGroceryChange: () => void,
  onNoteChange: () => void
): RealtimeUnsub {
  if (!isConfigured() || !supabase) return () => {}

  // Each call gets a unique channel name — Supabase throws if you add
  // postgres_changes listeners to an already-subscribed channel, which
  // happens when multiple useAuth() instances race to subscribe to the
  // same plan (e.g. the four components on the Settings page).
  const channelId = Math.random().toString(36).slice(2, 8)
  const channel = supabase
    .channel(`leisurely:${planId}:${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter: `id=eq.${planId}` }, onPlanChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meals', filter: `plan_id=eq.${planId}` }, onMealChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_items', filter: `plan_id=eq.${planId}` }, onGroceryChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `plan_id=eq.${planId}` }, onNoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'note_replies' }, onNoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'note_likes' }, onNoteChange)
    .subscribe()

  return () => { supabase?.removeChannel(channel) }
}

// ── Collaborator roster with profiles ─────────────────────────────────────────

export async function getCollaboratorsWithProfiles(
  planId: string
): Promise<Array<{ userId: string; role: string; joinedAt: string; displayName: string | null }>> {
  if (!isConfigured() || !supabase) return []
  const { data } = await supabase
    .from('plan_collaborators')
    .select('user_id, role, joined_at, profiles(display_name)')
    .eq('plan_id', planId)
  return (data ?? []).map((r) => {
    const profile = r.profiles
    const displayName = Array.isArray(profile)
      ? (profile[0]?.display_name ?? null)
      : (profile as { display_name: string | null } | null)?.display_name ?? null
    return {
      userId: r.user_id as string,
      role: r.role as string,
      joinedAt: r.joined_at as string,
      displayName,
    }
  })
}

export async function getPendingInvites(
  planId: string
): Promise<Array<{ id: string; email: string; expiresAt: string }>> {
  if (!isConfigured() || !supabase) return []
  const { data } = await supabase
    .from('plan_invites')
    .select('id, email, expires_at')
    .eq('plan_id', planId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
  return (data ?? []).map((r: { id: string; email: string; expires_at: string }) => ({
    id: r.id,
    email: r.email,
    expiresAt: r.expires_at,
  }))
}

export async function deleteInvite(inviteId: string): Promise<void> {
  if (!isConfigured() || !supabase) return
  await supabase.from('plan_invites').delete().eq('id', inviteId)
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  if (!isConfigured() || !supabase) return
  await supabase.from('profiles').upsert({ id: userId, display_name: displayName })
}

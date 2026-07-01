import { useState, type FormEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlanStore } from '../../stores/planStore'
import { useAuth } from '../../hooks/useAuth'
import { toggleNoteLike } from '../../lib/sync'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import type { Note } from '../../types'

interface NoteCardProps {
  note: Note
  currentUserId?: string
  onLike: () => void
  onAddReply: (text: string) => void
  onRemoveReply: (replyId: string) => void
  onDelete: () => void
}

function NoteCard({ note, currentUserId, onLike, onAddReply, onRemoveReply, onDelete }: NoteCardProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')

  function submitReply() {
    if (!replyText.trim()) return
    onAddReply(replyText)
    setReplyText('')
    setReplyOpen(false)
  }

  const isOwn = !!currentUserId && note.authorId === currentUserId
  const canDelete = !note.authorId || isOwn
  const authorLabel = note.authorName ?? null
  const replyCount = note.replies?.length ?? 0
  const liked = (note.likes ?? 0) > 0

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="flex">
        <div className={`w-1 shrink-0 rounded-l-card ${isOwn ? 'bg-sage/50' : 'bg-terracotta/50'}`} />
        <div className="flex-1 p-4">
          {authorLabel && (
            <p className="text-xs text-olive/40 mb-1">
              {authorLabel}{isOwn ? ' (you)' : ''}
            </p>
          )}
          <p className="text-sm text-olive whitespace-pre-wrap leading-relaxed pr-8">{note.text}</p>
          <div className="flex items-center justify-between mt-2">
            <time className="text-xs text-olive/40">
              {format(parseISO(note.createdAt), 'MMM d, yyyy · h:mm a')}
            </time>
            {canDelete && (
              <button
                onClick={onDelete}
                aria-label="Delete note"
                className="text-olive/25 hover:text-red-400 transition-colors rounded p-1"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" />
                </svg>
              </button>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-olive/8">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${
                liked
                  ? 'text-red-400 bg-red-50'
                  : 'text-olive/60 hover:text-red-400 hover:bg-red-50/60'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13.5S1.5 9.5 1.5 5.5a3 3 0 015.5-1.65A3 3 0 0114.5 5.5C14.5 9.5 8 13.5 8 13.5z" />
              </svg>
              {(note.likes ?? 0) > 0 ? note.likes : 'Like'}
            </button>

            <button
              onClick={() => setReplyOpen((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${
                replyOpen
                  ? 'text-sage bg-sage/10'
                  : 'text-olive/60 hover:text-sage hover:bg-sage/8'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9.5A6 6 0 112 7.5v.5l-1.5 4 4.5-1A6 6 0 0114 9.5z" />
              </svg>
              {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Comment'}
            </button>
          </div>
        </div>
      </div>

      {/* Reply thread */}
      <AnimatePresence>
        {(replyOpen || replyCount > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-olive/8 bg-olive/[0.02] px-4 py-3 space-y-3">
              {(note.replies ?? []).map((reply) => {
                const canDeleteReply = !reply.authorId || reply.authorId === currentUserId
                return (
                  <div key={reply.id} className="group flex gap-2.5">
                    <div className="w-px bg-olive/15 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      {reply.authorName && (
                        <p className="text-xs text-olive/35 mb-0.5">
                          {reply.authorName}{reply.authorId === currentUserId ? ' (you)' : ''}
                        </p>
                      )}
                      <p className="text-xs text-olive leading-relaxed whitespace-pre-wrap">{reply.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <time className="text-xs text-olive/35">
                          {format(parseISO(reply.createdAt), 'MMM d · h:mm a')}
                        </time>
                        {canDeleteReply && (
                          <button
                            onClick={() => onRemoveReply(reply.id)}
                            aria-label="Delete reply"
                            className="text-olive/25 hover:text-red-400 transition-colors rounded p-0.5"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                              <line x1="3" y1="3" x2="9" y2="9" /><line x1="9" y1="3" x2="3" y2="9" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {replyOpen && (
                <div className="flex gap-2 pt-1">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReply() }}
                    placeholder="Write a reply…"
                    className="flex-1 rounded-card border border-olive/20 bg-white px-3 py-1.5 text-xs text-olive placeholder:text-olive/35 focus:border-sage focus:ring-1 focus:ring-sage focus:outline-none"
                  />
                  <Button type="button" variant="primary" size="sm" onClick={submitReply} disabled={!replyText.trim()}>
                    Post
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NotesPage() {
  const notes = usePlanStore((s) => s.notes)
  const addNote = usePlanStore((s) => s.addNote)
  const removeNote = usePlanStore((s) => s.removeNote)
  const likeNote = usePlanStore((s) => s.likeNote)
  const addReply = usePlanStore((s) => s.addReply)
  const removeReply = usePlanStore((s) => s.removeReply)
  const { user, displayName } = useAuth()
  const [text, setText] = useState('')

  const authorStamp = displayName ?? user?.email?.split('@')[0] ?? undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    addNote(text, authorStamp, user?.id)
    setText('')
  }

  return (
    <div className="py-6 space-y-5">
      <div>
        <h2 className="text-lg font-serif font-semibold text-olive">Bulletin Board</h2>
        <p className="text-xs text-olive/50 mt-0.5">
          Jot down ideas, reminders, or notes for the trip.
        </p>
      </div>

      {/* Compose */}
      <form onSubmit={handleSubmit} className="bg-white rounded-card shadow-card p-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'What\'s on your mind? Try: "Pick up olive oil on arrival" or "Check if villa has a BBQ"'}
          rows={3}
          className="w-full rounded-card border border-olive/20 bg-cream px-3 py-2 text-sm text-olive placeholder:text-olive/35 focus:border-sage focus:ring-1 focus:ring-sage focus:outline-none resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as FormEvent)
          }}
        />
        <div className="flex justify-between items-center">
          {user ? (
            <span className="text-xs text-olive/35">
              Posting as <span className="font-medium text-olive/50">{authorStamp}</span>
            </span>
          ) : (
            <span className="text-xs text-olive/35">⌘↵ to post</span>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={!text.trim()}>
            Post note
          </Button>
        </div>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Post a note above to get started. Great for packing tips, restaurant ideas, or anything that shouldn't be forgotten."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <NoteCard
                  note={note}
                  currentUserId={user?.id}
                  onLike={() => {
                    likeNote(note.id)
                    if (user) toggleNoteLike(note.id, user.id, !!note.likedByMe)
                  }}
                  onAddReply={(t) => addReply(note.id, t, authorStamp, user?.id)}
                  onRemoveReply={(rid) => removeReply(note.id, rid)}
                  onDelete={() => removeNote(note.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

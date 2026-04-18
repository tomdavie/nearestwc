import { supabase } from '../supabaseClient'

export const USER_POINTS_CHANGED_EVENT = 'nearestwc:user-points-changed'

export function notifyUserPointsChanged() {
  window.dispatchEvent(new CustomEvent(USER_POINTS_CHANGED_EVENT))
}

export async function fetchUserPoints(userId) {
  if (!userId) return 0
  const { data } = await supabase.from('user_points').select('points').eq('user_id', userId).maybeSingle()
  return data?.points ?? 0
}

export async function incrementUserPoints(userId, delta) {
  if (!userId || !delta) return
  const { data: row } = await supabase.from('user_points').select('points').eq('user_id', userId).maybeSingle()
  const next = (row?.points ?? 0) + delta
  if (row) {
    const { error } = await supabase.from('user_points').update({ points: next }).eq('user_id', userId)
    if (error) throw new Error(error.message || 'Could not update points')
  } else {
    const { error } = await supabase.from('user_points').insert({ user_id: userId, points: next })
    if (error) throw new Error(error.message || 'Could not update points')
  }
  notifyUserPointsChanged()
}

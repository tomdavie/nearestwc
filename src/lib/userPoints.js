import { supabase } from '../supabaseClient'
import { getLevelFromPoints } from '../utils/points'
import { notifyUserPointsChanged } from './pointsEvents'
import { syncUserGamification } from './userGamification'

export { USER_POINTS_CHANGED_EVENT, notifyUserPointsChanged } from './pointsEvents'

export async function fetchUserPoints(userId) {
  if (!userId) return 0
  const { data } = await supabase.from('user_points').select('points').eq('user_id', userId).maybeSingle()
  return data?.points ?? 0
}

/**
 * @returns {Promise<{ newBadgeIds: string[], newBadges: import('../utils/points').BADGES[string][], level: import('../utils/points').LEVELS[0], error?: string }>}
 */
export async function incrementUserPoints(userId, delta) {
  if (!userId || !delta) {
    return { newBadgeIds: [], newBadges: [], level: getLevelFromPoints(0) }
  }
  const { data: row } = await supabase.from('user_points').select('points').eq('user_id', userId).maybeSingle()
  const next = (row?.points ?? 0) + delta
  if (row) {
    const { error } = await supabase.from('user_points').update({ points: next }).eq('user_id', userId)
    if (error) throw new Error(error.message || 'Could not update points')
  } else {
    const { error } = await supabase
      .from('user_points')
      .insert({ user_id: userId, points: next, level: 'desperate_dan', badges: [] })
    if (error) throw new Error(error.message || 'Could not update points')
  }
  const gamification = await syncUserGamification(userId)
  notifyUserPointsChanged()
  return gamification
}

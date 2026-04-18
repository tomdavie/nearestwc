import { supabase } from '../supabaseClient'
import { BADGES, checkAndAwardBadges, getLevelFromPoints, normaliseBadges } from '../utils/points'
import { buildBadgeSnapshot } from './gamificationSnapshot'

export async function fetchUserPointsRow(userId) {
  if (!userId) return null
  const { data } = await supabase.from('user_points').select('*').eq('user_id', userId).maybeSingle()
  return data
}

/**
 * Recompute level + merge new badges into user_points after points or activity change.
 * @returns {{ newBadgeIds: string[], newBadges: typeof BADGES[string][], level: ReturnType<typeof getLevelFromPoints> }}
 */
export async function syncUserGamification(userId) {
  if (!userId) return { newBadgeIds: [], newBadges: [], level: getLevelFromPoints(0) }

  let row = await fetchUserPointsRow(userId)
  if (!row) {
    const { data: inserted, error: insErr } = await supabase
      .from('user_points')
      .insert({ user_id: userId, points: 0, level: 'desperate_dan', badges: [] })
      .select()
      .single()
    if (insErr) {
      return { newBadgeIds: [], newBadges: [], level: getLevelFromPoints(0) }
    }
    row = inserted
  }

  const points = Number(row.points) || 0
  const levelObj = getLevelFromPoints(points)
  const snapshot = await buildBadgeSnapshot(userId, row)
  snapshot.points = points
  snapshot.badges = normaliseBadges(row.badges)

  const newBadgeIds = checkAndAwardBadges(snapshot)
  const merged = [...new Set([...snapshot.badges, ...newBadgeIds])]

  const { error } = await supabase
    .from('user_points')
    .update({ level: levelObj.id, badges: merged })
    .eq('user_id', userId)

  if (error) {
    return {
      newBadgeIds: [],
      newBadges: [],
      level: levelObj,
      error: error.message,
    }
  }

  const newBadges = newBadgeIds.map((id) => BADGES[id]).filter(Boolean)
  return { newBadgeIds, newBadges, level: levelObj }
}

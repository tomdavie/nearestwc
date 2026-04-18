import { supabase } from '../supabaseClient'

/**
 * Build counts for badge rules. Safe if optional columns (city, country, created_at) are missing.
 * @param {string} userId
 */
export async function buildBadgeSnapshot(userId, userPointsRow) {
  const points = Number(userPointsRow?.points) || 0
  const badges = userPointsRow?.badges

  const [
    toiletsAddedRes,
    reviewsRes,
    rollRes,
    myToiletsRes,
    countriesRes,
  ] = await Promise.all([
    supabase.from('toilets').select('*', { count: 'exact', head: true }).eq('added_by', userId),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('has_toilet_roll', true),
    supabase.from('toilets').select('id, city, country, created_at').eq('added_by', userId),
    supabase.from('toilets').select('country').eq('added_by', userId),
  ])

  const toiletsAddedCount = toiletsAddedRes.count ?? 0
  const reviewsCount = reviewsRes.count ?? 0
  const toiletRollConfirmCount = rollRes.count ?? 0

  const rows = myToiletsRes.data || []
  const countrySet = new Set(
    (countriesRes.data || []).map((r) => r.country).filter((c) => c != null && String(c).trim() !== ''),
  )
  const distinctCountriesFromWcs = countrySet.size

  let pioneerEligible = false
  const cities = new Set(
    rows.map((t) => (t.city != null ? String(t.city).trim() : '')).filter(Boolean),
  )
  for (const city of cities) {
    const res = await supabase
      .from('toilets')
      .select('id, added_by')
      .eq('city', city)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (res.error) continue
    if (res.data?.added_by === userId) {
      pioneerEligible = true
      break
    }
  }

  return {
    points,
    badges,
    reviewsCount,
    toiletsAddedCount,
    distinctCountriesFromWcs,
    toiletRollConfirmCount,
    pioneerEligible,
  }
}

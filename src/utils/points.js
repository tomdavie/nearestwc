/** Contributor tiers — min points inclusive */
export const LEVELS = [
  { id: 'desperate_dan', name: 'Desperate Dan', min: 0, emoji: '🚶' },
  { id: 'seasoned_squatter', name: 'Seasoned Squatter', min: 51, emoji: '🪑' },
  { id: 'porcelain_pro', name: 'Porcelain Pro', min: 151, emoji: '🏆' },
  { id: 'throne_inspector', name: 'Throne Inspector', min: 401, emoji: '👑' },
  { id: 'cistern_legend', name: 'Cistern Legend', min: 1001, emoji: '🚽✨' },
]

export const BADGES = {
  pioneer: {
    id: 'pioneer',
    name: 'Pioneer',
    emoji: '🗺️',
    description: 'First to add a WC in a city',
  },
  inspector: {
    id: 'inspector',
    name: 'Inspector',
    emoji: '🔍',
    description: 'Reviewed 10 WCs',
  },
  diamond_throne: {
    id: 'diamond_throne',
    name: 'Diamond Throne',
    emoji: '💎',
    description: 'Reviewed 50 WCs',
  },
  globetrotter: {
    id: 'globetrotter',
    name: 'Globetrotter',
    emoji: '🌍',
    description: 'Added WCs in 3+ countries',
  },
  always_prepared: {
    id: 'always_prepared',
    name: 'Always Prepared',
    emoji: '🧻',
    description: 'Confirmed toilet roll available 10 times',
  },
}

/** @param {number} points */
export function getLevelFromPoints(points) {
  const p = Math.max(0, Number(points) || 0)
  let current = LEVELS[0]
  for (const level of LEVELS) {
    if (p >= level.min) current = level
  }
  return current
}

/** @param {number} points */
export function getNextLevel(points) {
  const p = Number(points) || 0
  const current = getLevelFromPoints(p)
  const idx = LEVELS.findIndex((l) => l.id === current.id)
  if (idx < 0 || idx >= LEVELS.length - 1) return null
  return LEVELS[idx + 1]
}

/**
 * @param {number} points
 * @returns {{ next: typeof LEVELS[0], remaining: number } | null}
 */
export function getProgressToNextLevel(points) {
  const p = Number(points) || 0
  const next = getNextLevel(p)
  if (!next) return null
  return { next, remaining: Math.max(0, next.min - p) }
}

/**
 * Normalise badge list from DB (jsonb / text[] / null).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normaliseBadges(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Badge rules use an enriched snapshot (same table row + counts from the app).
 * @param {{
 *   points: number,
 *   badges: string[],
 *   reviewsCount: number,
 *   toiletsAddedCount: number,
 *   distinctCountriesFromWcs: number,
 *   toiletRollConfirmCount: number,
 *   pioneerEligible: boolean,
 * }} snapshot
 * @returns {string[]} newly earned badge ids (not already in snapshot.badges)
 */
export function checkAndAwardBadges(snapshot) {
  const existing = new Set(normaliseBadges(snapshot.badges))
  const newly = []

  const tryAdd = (id, condition) => {
    if (!condition || existing.has(id) || newly.includes(id)) return
    if (BADGES[id]) newly.push(id)
  }

  tryAdd('pioneer', snapshot.pioneerEligible === true)
  tryAdd('inspector', snapshot.reviewsCount >= 10)
  tryAdd('diamond_throne', snapshot.reviewsCount >= 50)
  tryAdd('globetrotter', snapshot.distinctCountriesFromWcs >= 3)
  tryAdd('always_prepared', snapshot.toiletRollConfirmCount >= 10)

  return newly
}

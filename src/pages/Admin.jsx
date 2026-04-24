import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { supabase } from '../supabaseClient'
import styles from './Admin.module.css'

function Admin() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [reports, setReports] = useState([])
  const [toilets, setToilets] = useState([])
  const [stats, setStats] = useState({ toilets: 0, reviews: 0, users: 0, reports: 0 })
  const [closedToilets, setClosedToilets] = useState([])

  const load = useCallback(async () => {
    const [{ data: reportsData }, { data: toiletsData }, { data: closedData }, reviewsCountRes, toiletsCountRes, usersCountRes, reportsCountRes] =
      await Promise.all([
        supabase.from('reports').select('id, toilet_id, user_id, reason, details, created_at, pending_review, confirmed_count, dismissed_count').order('created_at', { ascending: false }),
        supabase.from('toilets').select('id, name, created_at, is_closed').order('created_at', { ascending: false }).limit(40),
        supabase.from('toilets').select('id, name, created_at').eq('is_closed', true).order('created_at', { ascending: false }),
        supabase.from('reviews').select('*', { count: 'exact', head: true }),
        supabase.from('toilets').select('*', { count: 'exact', head: true }),
        supabase.from('user_points').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
      ])

    const toiletsById = Object.fromEntries((toiletsData || []).map((t) => [t.id, t.name || 'Unnamed WC']))
    setReports((reportsData || []).map((r) => ({ ...r, toiletName: toiletsById[r.toilet_id] || 'Unknown WC' })))
    setToilets(toiletsData || [])
    setClosedToilets(closedData || [])
    setStats({
      toilets: toiletsCountRes.count ?? 0,
      reviews: reviewsCountRes.count ?? 0,
      users: usersCountRes.count ?? 0,
      reports: reportsCountRes.count ?? 0,
    })
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const nextUser = data.user
      setUser(nextUser)
      if (!nextUser || nextUser.email !== 'tom@nearestwc.app') {
        navigate('/')
        return
      }
      load()
    })
  }, [load, navigate])

  const groupedReports = useMemo(() => {
    const map = {}
    for (const report of reports) {
      if (!map[report.toilet_id]) {
        map[report.toilet_id] = { toiletName: report.toiletName, items: [] }
      }
      map[report.toilet_id].items.push(report)
    }
    return Object.entries(map)
  }, [reports])

  const resolveReport = async (id) => {
    await supabase.from('reports').delete().eq('id', id)
    await load()
  }

  const removeToilet = async (id) => {
    await supabase.from('toilets').delete().eq('id', id)
    await load()
  }

  const reinstateToilet = async (id) => {
    await supabase.from('toilets').update({ is_closed: false }).eq('id', id)
    await load()
  }

  if (!user || user.email !== 'tom@nearestwc.app') return null

  return (
    <div className={styles.page}>
      <BackButton />
      <h1 className={styles.title}>Admin moderation</h1>

      <div className={styles.stats}>
        <span>Total toilets: {stats.toilets}</span>
        <span>Total reviews: {stats.reviews}</span>
        <span>Total users: {stats.users}</span>
        <span>Total reports: {stats.reports}</span>
      </div>

      <section className={styles.card}>
        <h2>Reports by toilet</h2>
        {groupedReports.length === 0 ? (
          <p>No reports pending.</p>
        ) : (
          groupedReports.map(([toiletId, group]) => (
            <div key={toiletId} className={styles.block}>
              <h3>{group.toiletName}</h3>
              {group.items.map((r) => (
                <div key={r.id} className={styles.item}>
                  <p><strong>{r.reason}</strong></p>
                  {r.details && <p>{r.details}</p>}
                  <button type="button" onClick={() => resolveReport(r.id)}>Mark resolved</button>
                </div>
              ))}
            </div>
          ))
        )}
      </section>

      <section className={styles.card}>
        <h2>Recently added toilets</h2>
        {toilets.map((t) => (
          <div key={t.id} className={styles.item}>
            <p>{t.name || 'Unnamed WC'}</p>
            <button type="button" onClick={() => removeToilet(t.id)}>Remove listing</button>
          </div>
        ))}
      </section>

      <section className={styles.card}>
        <h2>Closed toilets for manual review</h2>
        {closedToilets.length === 0 ? (
          <p>No closed toilets currently flagged.</p>
        ) : (
          closedToilets.map((t) => (
            <div key={t.id} className={styles.item}>
              <p>{t.name || 'Unnamed WC'}</p>
              <button type="button" onClick={() => reinstateToilet(t.id)}>Reinstate listing</button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

export default Admin

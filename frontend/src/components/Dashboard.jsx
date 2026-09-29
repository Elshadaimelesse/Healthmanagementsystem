import { useEffect, useState } from 'react'
import { api, money } from '../api.js'
import { useFlash } from '../flash.js'

const today = () => new Date().toISOString().slice(0, 10)
const STATUSES = ['available', 'occupied', 'cleaning', 'maintenance']

export default function Dashboard() {
  const flash = useFlash()
  const [d, setD] = useState(null)
  const [bookings, setBookings] = useState([])
  const [guests, setGuests] = useState([])
  const [rooms, setRooms] = useState([])

  const load = () => {
    api('/dashboard').then(setD)
    api('/bookings').then(setBookings)
    api('/guests').then(setGuests)
    api('/rooms').then(setRooms)
  }
  useEffect(() => { load() }, [])
  if (!d) return <p>Loading…</p>

  const guestName = (id) => guests.find((g) => g.id === id)?.name || '—'
  const roomNo = (id) => rooms.find((r) => r.id === id)?.number || '—'
  const t = today()
  const arrivals = bookings.filter((b) => b.status === 'reserved' && b.check_in === t)
  const departures = bookings.filter((b) => b.status === 'checked_in' && b.check_out === t)
  const recent = [...bookings].reverse().slice(0, 6)

  async function act(b, action) {
    try {
      await api(`/bookings/${b.id}/${action}`, 'POST')
      flash('Booking updated', 'success')
      load()
    } catch (x) { flash(x.message, 'error') }
  }

  const stats = [
    ['Occupancy', d.occupancy + '%', `${d.occupied} of ${d.rooms} rooms occupied`, d.occupancy],
    ['Arriving today', arrivals.length, 'Reserved, not yet checked in'],
    ['Leaving today', departures.length, 'Checked in, due out'],
    ['Available rooms', d.available, 'Ready to sell now'],
    ['Collected', money(d.revenue), 'Payments received'],
    ['Outstanding', money(d.outstanding), 'Unpaid on active bookings'],
  ]

  return (
    <>
      <p className="muted">{t}</p>

      <div className="stats">
        {stats.map(([label, value, note, pct]) => (
          <div className="stat panel" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {pct !== undefined && <div className="bar"><div style={{ width: pct + '%' }} /></div>}
            <small>{note}</small>
          </div>
        ))}
      </div>

      <div className="two">
        <div className="panel">
          <h3>Arrivals today</h3>
          <table>
            <thead><tr><th>Guest</th><th>Room</th><th /></tr></thead>
            <tbody>
              {arrivals.map((b) => (
                <tr key={b.id}>
                  <td>{guestName(b.guest_id)}</td>
                  <td>{roomNo(b.room_id)}</td>
                  <td><button onClick={() => act(b, 'checkin')}>Check in</button></td>
                </tr>
              ))}
              {arrivals.length === 0 && <tr><td colSpan="3" className="muted">No arrivals today.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Departures today</h3>
          <table>
            <thead><tr><th>Guest</th><th>Room</th><th>Balance</th><th /></tr></thead>
            <tbody>
              {departures.map((b) => (
                <tr key={b.id}>
                  <td>{guestName(b.guest_id)}</td>
                  <td>{roomNo(b.room_id)}</td>
                  <td>{money(b.total - b.paid)}</td>
                  <td><button onClick={() => act(b, 'checkout')}>Check out</button></td>
                </tr>
              ))}
              {departures.length === 0 && <tr><td colSpan="4" className="muted">No departures today.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <h3>Room status</h3>
          <table>
            <tbody>
              {STATUSES.map((s) => {
                const n = rooms.filter((r) => r.status === s).length
                return (
                  <tr key={s}>
                    <td><span className={'tag ' + s}>{s}</span></td>
                    <td>{n}</td>
                    <td className="grow">
                      <div className="bar"><div style={{ width: (rooms.length ? (n / rooms.length) * 100 : 0) + '%' }} /></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3>Recent bookings</h3>
          <table>
            <thead><tr><th>#</th><th>Guest</th><th>Room</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{guestName(b.guest_id)}</td>
                  <td>{roomNo(b.room_id)}</td>
                  <td><span className={'tag ' + b.status}>{b.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan="4" className="muted">No bookings yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

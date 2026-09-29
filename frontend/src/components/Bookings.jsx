import { useEffect, useState } from 'react'
import { api, money } from '../api.js'
import { useFlash } from '../flash.js'
import Invoice from './Invoice.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const plus = (d, n) => new Date(new Date(d).getTime() + n * 864e5).toISOString().slice(0, 10)
const FILTERS = [
  ['', 'All'],
  ['reserved', 'Reserved'],
  ['checked_in', 'Checked in'],
  ['checked_out', 'Checked out'],
  ['cancelled', 'Cancelled'],
]

export default function Bookings() {
  const flash = useFlash()
  const [bookings, setBookings] = useState([])
  const [guests, setGuests] = useState([])
  const [rooms, setRooms] = useState([])
  const [avail, setAvail] = useState([])
  const [invoice, setInvoice] = useState(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ guest_id: '', room_id: '', check_in: today(), check_out: plus(today(), 1), notes: '' })

  const load = () => {
    api('/bookings').then(setBookings)
    api('/guests').then(setGuests)
    api('/rooms').then(setRooms)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    api(`/rooms/available?from=${f.check_in}&to=${f.check_out}`).then(setAvail).catch(() => setAvail([]))
  }, [f.check_in, f.check_out, bookings])

  const guestOf = (id) => guests.find((g) => g.id === id)
  const roomOf = (id) => rooms.find((r) => r.id === id)
  const nights = Math.round((new Date(f.check_out) - new Date(f.check_in)) / 864e5)
  const picked = roomOf(+f.room_id)

  async function create(e) {
    e.preventDefault()
    try {
      await api('/bookings', 'POST', { ...f, guest_id: +f.guest_id, room_id: +f.room_id })
      flash('Booking created', 'success')
      setF({ ...f, room_id: '', notes: '' })
      load()
    } catch (x) { flash(x.message, 'error') }
  }

  async function act(b, action) {
    try {
      let body
      if (action === 'cancel' && !confirm(`Cancel booking #${b.id}?`)) return
      if (action === 'payment') {
        const v = prompt(`Amount to record (balance ${money(b.total - b.paid)})`, b.total - b.paid)
        if (!v) return
        body = { Amount: +v }
      }
      await api(`/bookings/${b.id}/${action}`, 'POST', body)
      flash('Booking updated', 'success')
      load()
    } catch (x) { flash(x.message, 'error') }
  }

  const shown = [...bookings].reverse().filter((b) => {
    if (status && b.status !== status) return false
    const text = `${guestOf(b.guest_id)?.name || ''} ${roomOf(b.room_id)?.number || ''}`.toLowerCase()
    return text.includes(q.toLowerCase())
  })

  return (
    <>
      {invoice && (
        <Invoice
          booking={invoice}
          guest={guestOf(invoice.guest_id)}
          room={roomOf(invoice.room_id)}
          onClose={() => setInvoice(null)}
        />
      )}

      <form className="panel row" onSubmit={create}>
        <select value={f.guest_id} onChange={(e) => setF({ ...f, guest_id: e.target.value })} required>
          <option value="">Choose a guest</option>
          {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input type="date" min={today()} value={f.check_in}
          onChange={(e) => setF({ ...f, check_in: e.target.value, check_out: plus(e.target.value, 1) })} />
        <input type="date" min={plus(f.check_in, 1)} value={f.check_out}
          onChange={(e) => setF({ ...f, check_out: e.target.value })} />
        <select value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })} required>
          <option value="">Choose a free room</option>
          {avail.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.type} · {money(r.price)}</option>)}
        </select>
        <input placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <button className="primary">Book room</button>
        <span className="muted">
          {nights > 0 && `${nights} night${nights === 1 ? '' : 's'}`}
          {picked && nights > 0 && ` · ${money(nights * picked.price)}`}
        </span>
      </form>

      <div className="panel row">
        <input placeholder="Search guest or room" value={q} onChange={(e) => setQ(e.target.value)} />
        {FILTERS.map(([value, label]) => (
          <button key={label} className={status === value ? 'primary' : ''} onClick={() => setStatus(value)}>
            {label}
          </button>
        ))}
      </div>

      <table className="panel">
        <thead>
          <tr><th>#</th><th>Guest</th><th>Room</th><th>Stay</th><th>Total</th><th>Paid</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {shown.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{guestOf(b.guest_id)?.name || '—'}{b.notes && <><br /><small className="muted">{b.notes}</small></>}</td>
              <td>{roomOf(b.room_id)?.number || '—'}</td>
              <td>{b.check_in} to {b.check_out}</td>
              <td>{money(b.total)}</td>
              <td>{money(b.paid)}</td>
              <td><span className={'tag ' + b.status}>{b.status.replace('_', ' ')}</span></td>
              <td className="actions">
                {b.status === 'reserved' && <>
                  <button onClick={() => act(b, 'checkin')}>Check in</button>
                  <button onClick={() => act(b, 'cancel')}>Cancel</button>
                </>}
                {(b.status === 'reserved' || b.status === 'checked_in') && b.paid < b.total &&
                  <button onClick={() => act(b, 'payment')}>Record payment</button>}
                {b.status === 'checked_in' && <button onClick={() => act(b, 'checkout')}>Check out</button>}
                {b.status !== 'cancelled' && <button onClick={() => setInvoice(b)}>Invoice</button>}
              </td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan="8">No bookings match. Create one with the form above.</td></tr>}
        </tbody>
      </table>
    </>
  )
}

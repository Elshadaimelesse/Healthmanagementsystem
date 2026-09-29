import { useEffect, useState } from 'react'
import { api, money } from '../api.js'
import { useFlash } from '../flash.js'

const STATUSES = ['available', 'occupied', 'cleaning', 'maintenance']
const TYPES = ['Single', 'Double', 'Twin', 'Suite', 'Family']
const blank = { number: '', type: 'Double', price: '', capacity: 2 }

export default function Rooms() {
  const flash = useFlash()
  const [rooms, setRooms] = useState([])
  const [f, setF] = useState(blank)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const load = () => api('/rooms').then(setRooms)
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    try {
      await api('/rooms', 'POST', { ...f, price: +f.price, capacity: +f.capacity })
      flash('Room added', 'success')
      setF(blank)
      load()
    } catch (x) { flash(x.message, 'error') }
  }

  async function update(room, changes, message) {
    try {
      await api('/rooms/' + room.id, 'PUT', { ...room, ...changes })
      flash(message, 'success')
      load()
    } catch (x) { flash(x.message, 'error') }
  }

  function editPrice(room) {
    const v = prompt(`New price per night for room ${room.number}`, room.price)
    if (v && +v > 0) update(room, { price: +v }, 'Price updated')
  }

  async function remove(room) {
    if (!confirm(`Delete room ${room.number}?`)) return
    try {
      await api('/rooms/' + room.id, 'DELETE')
      flash('Room deleted', 'success')
      load()
    } catch (x) { flash(x.message, 'error') }
  }

  const count = (s) => rooms.filter((r) => r.status === s).length
  const shown = rooms.filter(
    (r) =>
      r.number.toLowerCase().includes(q.toLowerCase()) &&
      (!type || r.type === type) &&
      (!status || r.status === status)
  )

  return (
    <>
      <div className="stats">
        {[['Total rooms', rooms.length], ['Available', count('available')], ['Occupied', count('occupied')],
          ['Cleaning', count('cleaning')], ['Maintenance', count('maintenance')]].map(([label, n]) => (
          <div className="stat panel" key={label}><span>{label}</span><strong>{n}</strong></div>
        ))}
      </div>

      <form className="panel row" onSubmit={add}>
        <input placeholder="Room number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} required />
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input type="number" step="0.01" min="0" placeholder="Price per night" value={f.price}
          onChange={(e) => setF({ ...f, price: e.target.value })} required />
        <input type="number" min="1" placeholder="Sleeps" value={f.capacity}
          onChange={(e) => setF({ ...f, capacity: e.target.value })} />
        <button className="primary">Add room</button>
      </form>

      <div className="panel row">
        <input placeholder="Search room number" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <table className="panel">
        <thead>
          <tr><th>Room</th><th>Type</th><th>Sleeps</th><th>Per night</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td>{r.number}</td>
              <td>{r.type}</td>
              <td>{r.capacity}</td>
              <td>{money(r.price)}</td>
              <td>
                <select className={'tag ' + r.status} value={r.status}
                  onChange={(e) => update(r, { status: e.target.value }, 'Status updated')}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="actions">
                <button onClick={() => editPrice(r)}>Edit price</button>
                <button onClick={() => remove(r)} disabled={r.status === 'occupied'}
                  title={r.status === 'occupied' ? 'Check the guest out first' : ''}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan="6">No rooms match. Add one with the form above.</td></tr>}
        </tbody>
      </table>
    </>
  )
}

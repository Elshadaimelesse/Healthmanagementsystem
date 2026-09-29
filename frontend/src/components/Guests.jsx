import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useFlash } from '../flash.js'

const blank = { name: '', email: '', phone: '', id_number: '' }

export default function Guests() {
  const flash = useFlash()
  const [guests, setGuests] = useState([])
  const [f, setF] = useState(blank)
  const [q, setQ] = useState('')
  const load = () => api('/guests').then(setGuests)
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    try {
      await api('/guests', 'POST', f)
      flash('Guest added', 'success')
      setF(blank)
      load()
    } catch (x) { flash(x.message, 'error') }
  }
  async function remove(g) {
    if (!confirm(`Delete ${g.name}?`)) return
    try {
      await api('/guests/' + g.id, 'DELETE')
      flash('Guest deleted', 'success')
      load()
    } catch (x) { flash(x.message, 'error') }
  }
  const field = (key, placeholder, type = 'text') => (
    <input type={type} placeholder={placeholder} value={f[key]}
      onChange={(e) => setF({ ...f, [key]: e.target.value })} />
  )
  const shown = guests.filter((g) =>
    `${g.name} ${g.email} ${g.phone} ${g.id_number}`.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <>
      <form className="panel row" onSubmit={add}>
        <input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        {field('email', 'Email', 'email')}
        {field('phone', 'Phone', 'tel')}
        {field('id_number', 'ID or passport number')}
        <button className="primary">Add guest</button>
      </form>

      <div className="panel row">
        <input placeholder="Search by name, phone, email or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{shown.length} guest{shown.length === 1 ? '' : 's'}</span>
      </div>

      <table className="panel">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>ID number</th><th /></tr></thead>
        <tbody>
          {shown.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td>{g.email || '—'}</td>
              <td>{g.phone || '—'}</td>
              <td>{g.id_number || '—'}</td>
              <td><button onClick={() => remove(g)}>Delete</button></td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan="5">No guests match. Add one with the form above.</td></tr>}
        </tbody>
      </table>
    </>
  )
}

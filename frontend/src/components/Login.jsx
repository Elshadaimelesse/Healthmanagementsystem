import { useState } from 'react'
import { api } from '../api.js'

export default function Login({ onDone }) {
  const [username, setU] = useState('admin')
  const [password, setP] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    try {
      const { token } = await api('/login', 'POST', { username, password })
      localStorage.setItem('token', token)
      onDone()
    } catch (x) {
      setErr(x.message)
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} className="panel">
        <h1>Hotel desk</h1>
        <label>Username<input value={username} onChange={(e) => setU(e.target.value)} /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setP(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button className="primary">Sign in</button>
      </form>
    </div>
  )
}

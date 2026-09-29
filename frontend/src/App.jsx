import { useState } from 'react'
import { FlashContext } from './flash.js'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Rooms from './components/Rooms.jsx'
import Guests from './components/Guests.jsx'
import Bookings from './components/Bookings.jsx'
import Toast from './components/Toast.jsx'

const TABS = [
  ['Dashboard', Dashboard],
  ['Bookings', Bookings],
  ['Rooms', Rooms],
  ['Guests', Guests],
]

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'))
  const [tab, setTab] = useState('Dashboard')
  const [toast, setToast] = useState({ message: '', kind: 'info' })
  const flash = (message, kind = 'info') => setToast({ message, kind })

  if (!authed) return <Login onDone={() => setAuthed(true)} />
  const Page = TABS.find(([n]) => n === tab)[1]

  return (
    <FlashContext.Provider value={flash}>
      <div className="shell">
        <aside className="side">
          <h1>🏨 Hotel desk</h1>
          <nav>
            {TABS.map(([name]) => (
              <button
                key={name}
                className={tab === name ? 'on' : ''}
                aria-current={tab === name ? 'page' : undefined}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </nav>
          <small>Signed in as admin</small>
          <button
            className="out"
            onClick={() => {
              localStorage.removeItem('token')
              setAuthed(false)
            }}
          >
            Sign out
          </button>
        </aside>
        <main>
          <Toast message={toast.message} kind={toast.kind} onDone={() => flash('')} />
          <h2>{tab}</h2>
          <Page />
        </main>
      </div>
    </FlashContext.Provider>
  )
}

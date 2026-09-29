import { useEffect } from 'react'

export default function Toast({ message, kind = 'info', onDone }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [message])

  if (!message) return null
  return <div className={'flash ' + kind} role="status">{message}</div>
}

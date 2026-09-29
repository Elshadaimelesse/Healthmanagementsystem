export async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/login') {
    localStorage.removeItem('token')
    location.reload()
  }
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const money = (n) => '$' + Number(n || 0).toFixed(2)

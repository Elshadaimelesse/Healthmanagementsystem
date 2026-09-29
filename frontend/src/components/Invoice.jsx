import { money } from '../api.js'

const TAX_RATE = 10 // percent, change to your local rate

export default function Invoice({ booking, guest, room, onClose }) {
  const nights = Math.round((new Date(booking.check_out) - new Date(booking.check_in)) / 864e5)
  const sub = booking.total
  const tax = (sub * TAX_RATE) / 100
  const total = sub + tax
  const balance = total - booking.paid

  return (
    <div className="panel invoice">
      <header className="inv-head">
        <div>
          <h2>Invoice #{String(booking.id).padStart(5, '0')}</h2>
          <p className="muted">Issued {new Date().toISOString().slice(0, 10)}</p>
        </div>
        <div className="hotel">
          <b>Your Hotel Name</b><br />
          Hotel address<br />
          Hotel phone
        </div>
      </header>

      <section className="inv-cols">
        <div>
          <h4>Billed to</h4>
          <p>
            <b>{guest?.name}</b><br />
            {guest?.email && <>{guest.email}<br /></>}
            {guest?.phone && <>{guest.phone}<br /></>}
            {guest?.id_number && <>ID: {guest.id_number}</>}
          </p>
        </div>
        <div>
          <h4>Stay</h4>
          <p>
            <b>Room:</b> {room?.number} ({room?.type})<br />
            <b>Check-in:</b> {booking.check_in}<br />
            <b>Check-out:</b> {booking.check_out}<br />
            <b>Nights:</b> {nights}
          </p>
        </div>
        <div>
          <h4>Status</h4>
          <p><span className={'tag ' + booking.status}>{booking.status.replace('_', ' ')}</span></p>
        </div>
      </section>

      <table className="lines">
        <thead>
          <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Room {room?.number} ({room?.type})</td>
            <td>{nights} nights</td>
            <td>{money(room?.price)}</td>
            <td>{money(sub)}</td>
          </tr>
          <tr><td colSpan="3">Subtotal</td><td>{money(sub)}</td></tr>
          <tr><td colSpan="3">Tax ({TAX_RATE}%)</td><td>{money(tax)}</td></tr>
          <tr className="total"><th colSpan="3">Total</th><th>{money(total)}</th></tr>
          <tr><td colSpan="3">Paid</td><td>{money(booking.paid)}</td></tr>
          <tr className="total"><th colSpan="3">Balance due</th><th>{money(balance)}</th></tr>
        </tbody>
      </table>

      {booking.notes && <p><b>Notes:</b> {booking.notes}</p>}
      <p className="muted">Payment is due at check-out. Thank you for staying with us.</p>

      <p className="noprint">
        <button className="primary" onClick={() => window.print()}>Print</button>{' '}
        <button onClick={onClose}>Close</button>
      </p>
    </div>
  )
}

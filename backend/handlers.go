package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Server struct{ st *Store }

const dateFmt = "2006-01-02"

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func pathID(r *http.Request) int {
	id, _ := strconv.Atoi(r.PathValue("id"))
	return id
}

// ---------- auth ----------

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct{ Username, Password string }
	json.NewDecoder(r.Body).Decode(&in)
	if in.Username != adminUser || in.Password != adminPass {
		fail(w, 401, "Wrong username or password")
		return
	}
	b := make([]byte, 16)
	rand.Read(b)
	tok := hex.EncodeToString(b)
	s.st.mu.Lock()
	s.st.tokens[tok] = true
	s.st.mu.Unlock()
	writeJSON(w, 200, map[string]string{"token": tok})
}

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		s.st.mu.Lock()
		ok := s.st.tokens[tok]
		s.st.mu.Unlock()
		if !ok {
			fail(w, 401, "Please sign in")
			return
		}
		next(w, r)
	}
}

// ---------- rooms ----------

func (s *Server) listRooms(w http.ResponseWriter, r *http.Request) {
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	writeJSON(w, 200, s.st.DB.Rooms)
}

func overlaps(aIn, aOut, bIn, bOut string) bool { return aIn < bOut && bIn < aOut }

func (s *Server) roomBusy(roomID int, in, out string) bool {
	for _, b := range s.st.DB.Bookings {
		if b.RoomID == roomID && (b.Status == "reserved" || b.Status == "checked_in") &&
			overlaps(in, out, b.CheckIn, b.CheckOut) {
			return true
		}
	}
	return false
}

func (s *Server) availableRooms(w http.ResponseWriter, r *http.Request) {
	in, out := r.URL.Query().Get("from"), r.URL.Query().Get("to")
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	res := []Room{}
	for _, rm := range s.st.DB.Rooms {
		if rm.Status != "maintenance" && !s.roomBusy(rm.ID, in, out) {
			res = append(res, rm)
		}
	}
	writeJSON(w, 200, res)
}

func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) {
	var x Room
	if json.NewDecoder(r.Body).Decode(&x) != nil || x.Number == "" || x.Price <= 0 {
		fail(w, 400, "Room number and a price above 0 are required")
		return
	}
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	for _, rm := range s.st.DB.Rooms {
		if rm.Number == x.Number {
			fail(w, 409, "A room with this number already exists")
			return
		}
	}
	x.ID = s.st.next()
	if x.Status == "" {
		x.Status = "available"
	}
	if x.Capacity < 1 {
		x.Capacity = 1
	}
	s.st.DB.Rooms = append(s.st.DB.Rooms, x)
	s.st.save()
	writeJSON(w, 201, x)
}

func (s *Server) updateRoom(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	var x Room
	if json.NewDecoder(r.Body).Decode(&x) != nil {
		fail(w, 400, "Invalid data")
		return
	}
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	for i := range s.st.DB.Rooms {
		if s.st.DB.Rooms[i].ID == id {
			x.ID = id
			s.st.DB.Rooms[i] = x
			s.st.save()
			writeJSON(w, 200, x)
			return
		}
	}
	fail(w, 404, "Room not found")
}

func (s *Server) deleteRoom(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	for _, b := range s.st.DB.Bookings {
		if b.RoomID == id && (b.Status == "reserved" || b.Status == "checked_in") {
			fail(w, 409, "This room has active bookings")
			return
		}
	}
	for i, rm := range s.st.DB.Rooms {
		if rm.ID == id {
			s.st.DB.Rooms = append(s.st.DB.Rooms[:i], s.st.DB.Rooms[i+1:]...)
			s.st.save()
			writeJSON(w, 200, map[string]bool{"deleted": true})
			return
		}
	}
	fail(w, 404, "Room not found")
}

// ---------- guests ----------

func (s *Server) listGuests(w http.ResponseWriter, r *http.Request) {
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	writeJSON(w, 200, s.st.DB.Guests)
}

func (s *Server) createGuest(w http.ResponseWriter, r *http.Request) {
	var x Guest
	if json.NewDecoder(r.Body).Decode(&x) != nil || strings.TrimSpace(x.Name) == "" {
		fail(w, 400, "Guest name is required")
		return
	}
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	x.ID = s.st.next()
	s.st.DB.Guests = append(s.st.DB.Guests, x)
	s.st.save()
	writeJSON(w, 201, x)
}

func (s *Server) deleteGuest(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	for _, b := range s.st.DB.Bookings {
		if b.GuestID == id && (b.Status == "reserved" || b.Status == "checked_in") {
			fail(w, 409, "This guest has active bookings")
			return
		}
	}
	for i, g := range s.st.DB.Guests {
		if g.ID == id {
			s.st.DB.Guests = append(s.st.DB.Guests[:i], s.st.DB.Guests[i+1:]...)
			s.st.save()
			writeJSON(w, 200, map[string]bool{"deleted": true})
			return
		}
	}
	fail(w, 404, "Guest not found")
}

// ---------- bookings ----------

func (s *Server) listBookings(w http.ResponseWriter, r *http.Request) {
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	writeJSON(w, 200, s.st.DB.Bookings)
}

func (s *Server) createBooking(w http.ResponseWriter, r *http.Request) {
	var x Booking
	if json.NewDecoder(r.Body).Decode(&x) != nil {
		fail(w, 400, "Invalid data")
		return
	}
	in, e1 := time.Parse(dateFmt, x.CheckIn)
	out, e2 := time.Parse(dateFmt, x.CheckOut)
	if e1 != nil || e2 != nil || !out.After(in) {
		fail(w, 400, "Check-out must be after check-in")
		return
	}
	nights := math.Round(out.Sub(in).Hours() / 24)

	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	var room *Room
	for i := range s.st.DB.Rooms {
		if s.st.DB.Rooms[i].ID == x.RoomID {
			room = &s.st.DB.Rooms[i]
		}
	}
	if room == nil || room.Status == "maintenance" {
		fail(w, 400, "Choose a room that is in service")
		return
	}
	guestOK := false
	for _, g := range s.st.DB.Guests {
		if g.ID == x.GuestID {
			guestOK = true
		}
	}
	if !guestOK {
		fail(w, 400, "Choose a guest")
		return
	}
	if s.roomBusy(x.RoomID, x.CheckIn, x.CheckOut) {
		fail(w, 409, "Room is already booked for these dates")
		return
	}
	x.ID = s.st.next()
	x.Status = "reserved"
	x.Total = nights * room.Price
	x.Paid = 0
	s.st.DB.Bookings = append(s.st.DB.Bookings, x)
	s.st.save()
	writeJSON(w, 201, x)
}

func (s *Server) bookingAction(w http.ResponseWriter, r *http.Request) {
	id, action := pathID(r), r.PathValue("action")
	var body struct{ Amount float64 }
	json.NewDecoder(r.Body).Decode(&body)

	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	var b *Booking
	for i := range s.st.DB.Bookings {
		if s.st.DB.Bookings[i].ID == id {
			b = &s.st.DB.Bookings[i]
		}
	}
	if b == nil {
		fail(w, 404, "Booking not found")
		return
	}
	setRoom := func(status string) {
		for i := range s.st.DB.Rooms {
			if s.st.DB.Rooms[i].ID == b.RoomID {
				s.st.DB.Rooms[i].Status = status
			}
		}
	}
	switch action {
	case "checkin":
		if b.Status != "reserved" {
			fail(w, 409, "Only reserved bookings can check in")
			return
		}
		b.Status = "checked_in"
		setRoom("occupied")
	case "checkout":
		if b.Status != "checked_in" {
			fail(w, 409, "Only checked-in guests can check out")
			return
		}
		if b.Paid < b.Total {
			fail(w, 409, "Balance of "+strconv.FormatFloat(b.Total-b.Paid, 'f', 2, 64)+" is unpaid")
			return
		}
		b.Status = "checked_out"
		setRoom("cleaning")
	case "cancel":
		if b.Status != "reserved" {
			fail(w, 409, "Only reserved bookings can be cancelled")
			return
		}
		b.Status = "cancelled"
	case "payment":
		if body.Amount <= 0 || b.Paid+body.Amount > b.Total+0.001 {
			fail(w, 400, "Enter an amount up to the remaining balance")
			return
		}
		b.Paid += body.Amount
	default:
		fail(w, 404, "Unknown action")
		return
	}
	s.st.save()
	writeJSON(w, 200, b)
}

// ---------- dashboard ----------

func (s *Server) dashboard(w http.ResponseWriter, r *http.Request) {
	today := time.Now().Format(dateFmt)
	s.st.mu.Lock()
	defer s.st.mu.Unlock()
	total, occupied, available := len(s.st.DB.Rooms), 0, 0
	for _, rm := range s.st.DB.Rooms {
		if rm.Status == "occupied" {
			occupied++
		}
		if rm.Status == "available" {
			available++
		}
	}
	arrivals, departures, revenue, outstanding := 0, 0, 0.0, 0.0
	for _, b := range s.st.DB.Bookings {
		if b.Status == "reserved" && b.CheckIn == today {
			arrivals++
		}
		if b.Status == "checked_in" && b.CheckOut == today {
			departures++
		}
		if b.Status != "cancelled" {
			revenue += b.Paid
			outstanding += b.Total - b.Paid
		}
	}
	occ := 0.0
	if total > 0 {
		occ = math.Round(float64(occupied) / float64(total) * 100)
	}
	writeJSON(w, 200, map[string]any{
		"rooms": total, "occupied": occupied, "available": available,
		"occupancy": occ, "arrivals": arrivals, "departures": departures,
		"revenue": revenue, "outstanding": outstanding, "guests": len(s.st.DB.Guests),
	})
}

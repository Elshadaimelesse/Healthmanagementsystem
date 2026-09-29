package main

import (
	"encoding/json"
	"os"
	"sync"
)

type Room struct {
	ID       int     `json:"id"`
	Number   string  `json:"number"`
	Type     string  `json:"type"`
	Price    float64 `json:"price"`
	Capacity int     `json:"capacity"`
	Status   string  `json:"status"` // available, occupied, cleaning, maintenance
}

type Guest struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	IDNumber string `json:"id_number"`
}

type Booking struct {
	ID       int     `json:"id"`
	RoomID   int     `json:"room_id"`
	GuestID  int     `json:"guest_id"`
	CheckIn  string  `json:"check_in"`
	CheckOut string  `json:"check_out"`
	Status   string  `json:"status"` // reserved, checked_in, checked_out, cancelled
	Total    float64 `json:"total"`
	Paid     float64 `json:"paid"`
	Notes    string  `json:"notes"`
}

type DB struct {
	Rooms    []Room    `json:"rooms"`
	Guests   []Guest   `json:"guests"`
	Bookings []Booking `json:"bookings"`
	NextID   int       `json:"next_id"`
}

type Store struct {
	mu     sync.Mutex
	path   string
	DB     DB
	tokens map[string]bool
}

func NewStore(path string) *Store {
	s := &Store{path: path, tokens: map[string]bool{}}
	s.DB.NextID = 1
	if b, err := os.ReadFile(path); err == nil {
		json.Unmarshal(b, &s.DB)
	}
	if s.DB.NextID < 1 {
		s.DB.NextID = 1
	}
	if len(s.DB.Rooms) == 0 {
		seed := []Room{
			{Number: "101", Type: "Single", Price: 60, Capacity: 1},
			{Number: "102", Type: "Double", Price: 90, Capacity: 2},
			{Number: "201", Type: "Suite", Price: 180, Capacity: 4},
		}
		for _, r := range seed {
			r.ID = s.next()
			r.Status = "available"
			s.DB.Rooms = append(s.DB.Rooms, r)
		}
		s.save()
	}
	return s
}

// next returns a new unique id. Caller must hold the lock (or be in setup).
func (s *Store) next() int {
	id := s.DB.NextID
	s.DB.NextID++
	return id
}

// save writes the database to disk. Caller must hold the lock.
func (s *Store) save() {
	b, _ := json.MarshalIndent(s.DB, "", "  ")
	os.WriteFile(s.path, b, 0644)
}

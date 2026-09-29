package main

import (
	"log"
	"net/http"
)

const (
	adminUser = "admin"
	adminPass = "admin123"
)

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	s := &Server{st: NewStore("data.json")}
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("GET /api/dashboard", s.auth(s.dashboard))

	mux.HandleFunc("GET /api/rooms", s.auth(s.listRooms))
	mux.HandleFunc("GET /api/rooms/available", s.auth(s.availableRooms))
	mux.HandleFunc("POST /api/rooms", s.auth(s.createRoom))
	mux.HandleFunc("PUT /api/rooms/{id}", s.auth(s.updateRoom))
	mux.HandleFunc("DELETE /api/rooms/{id}", s.auth(s.deleteRoom))

	mux.HandleFunc("GET /api/guests", s.auth(s.listGuests))
	mux.HandleFunc("POST /api/guests", s.auth(s.createGuest))
	mux.HandleFunc("DELETE /api/guests/{id}", s.auth(s.deleteGuest))

	mux.HandleFunc("GET /api/bookings", s.auth(s.listBookings))
	mux.HandleFunc("POST /api/bookings", s.auth(s.createBooking))
	mux.HandleFunc("POST /api/bookings/{id}/{action}", s.auth(s.bookingAction))

	log.Println("Hotel API listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", cors(mux)))
}

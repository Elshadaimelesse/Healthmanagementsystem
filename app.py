import os, sqlite3
from datetime import date
from functools import wraps
from flask import Flask, g, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, "hotel.db")
TAX = 0.10
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-me-in-production")


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_=None):
    d = g.pop("db", None)
    if d:
        d.close()


def init_db():
    con = sqlite3.connect(DB)
    with open(os.path.join(BASE, "schema.sql")) as f:
        con.executescript(f.read())
    if not con.execute("SELECT 1 FROM users").fetchone():
        con.execute("INSERT INTO users(username,password_hash) VALUES(?,?)",
                    ("admin", generate_password_hash("admin123")))
        for n, t, p in [("101", "Single", 60), ("102", "Double", 90), ("201", "Suite", 180)]:
            con.execute("INSERT INTO rooms(number,type,price) VALUES(?,?,?)", (n, t, p))
    con.commit()
    con.close()


def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        if "user" not in session:
            return redirect(url_for("login"))
        return fn(*a, **kw)
    return wrapper


def is_free(room_id, ci, co):
    row = db().execute(
        "SELECT 1 FROM bookings WHERE room_id=? AND status IN ('booked','checked_in') "
        "AND check_in < ? AND check_out > ?", (room_id, co, ci)).fetchone()
    return row is None


def nights(ci, co):
    return (date.fromisoformat(co) - date.fromisoformat(ci)).days


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = db().execute("SELECT * FROM users WHERE username=?", (request.form["username"],)).fetchone()
        if u and check_password_hash(u["password_hash"], request.form["password"]):
            session["user"] = u["username"]
            return redirect(url_for("dashboard"))
        flash("Invalid username or password")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def dashboard():
    q = lambda s: db().execute(s).fetchone()[0]
    stats = {
        "rooms": q("SELECT COUNT(*) FROM rooms"),
        "occupied": q("SELECT COUNT(*) FROM bookings WHERE status='checked_in'"),
        "upcoming": q("SELECT COUNT(*) FROM bookings WHERE status='booked'"),
        "guests": q("SELECT COUNT(*) FROM guests"),
        "revenue": q("SELECT COALESCE(SUM(total),0) FROM bookings WHERE status='checked_out'"),
    }
    return render_template("dashboard.html", s=stats)


@app.route("/rooms", methods=["GET", "POST"])
@login_required
def rooms():
    if request.method == "POST":
        try:
            db().execute("INSERT INTO rooms(number,type,price) VALUES(?,?,?)",
                         (request.form["number"], request.form["type"], float(request.form["price"])))
            db().commit()
        except (sqlite3.IntegrityError, ValueError):
            flash("Could not add room (duplicate number or bad price)")
        return redirect(url_for("rooms"))
    rows = db().execute(
        "SELECT r.*, (SELECT COUNT(*) FROM bookings b WHERE b.room_id=r.id AND b.status='checked_in') AS occupied "
        "FROM rooms r ORDER BY number").fetchall()
    return render_template("rooms.html", rooms=rows)


@app.route("/rooms/<int:rid>/delete", methods=["POST"])
@login_required
def delete_room(rid):
    if db().execute("SELECT 1 FROM bookings WHERE room_id=?", (rid,)).fetchone():
        flash("Room has bookings and cannot be deleted")
    else:
        db().execute("DELETE FROM rooms WHERE id=?", (rid,))
        db().commit()
    return redirect(url_for("rooms"))


@app.route("/guests", methods=["GET", "POST"])
@login_required
def guests():
    if request.method == "POST":
        db().execute("INSERT INTO guests(name,phone,email) VALUES(?,?,?)",
                     (request.form["name"], request.form["phone"], request.form["email"]))
        db().commit()
        return redirect(url_for("guests"))
    return render_template("guests.html", guests=db().execute("SELECT * FROM guests ORDER BY name").fetchall())


@app.route("/bookings", methods=["GET", "POST"])
@login_required
def bookings():
    if request.method == "POST":
        f = request.form
        try:
            valid = nights(f["check_in"], f["check_out"]) > 0
        except ValueError:
            valid = False
        if not valid:
            flash("Check-out must be after check-in")
        elif not is_free(f["room_id"], f["check_in"], f["check_out"]):
            flash("Room is not available for those dates")
        else:
            db().execute("INSERT INTO bookings(guest_id,room_id,check_in,check_out) VALUES(?,?,?,?)",
                         (f["guest_id"], f["room_id"], f["check_in"], f["check_out"]))
            db().commit()
            flash("Booking created")
        return redirect(url_for("bookings"))
    rows = db().execute(
        "SELECT b.*, g.name AS guest, r.number AS room FROM bookings b "
        "JOIN guests g ON g.id=b.guest_id JOIN rooms r ON r.id=b.room_id ORDER BY b.check_in DESC").fetchall()
    return render_template("bookings.html", bookings=rows,
                           guests=db().execute("SELECT * FROM guests ORDER BY name").fetchall(),
                           rooms=db().execute("SELECT * FROM rooms ORDER BY number").fetchall())


@app.route("/bookings/<int:bid>/<action>", methods=["POST"])
@login_required
def booking_action(bid, action):
    b = db().execute("SELECT b.*, r.price FROM bookings b JOIN rooms r ON r.id=b.room_id WHERE b.id=?", (bid,)).fetchone()
    if not b:
        return redirect(url_for("bookings"))
    if action == "checkin" and b["status"] == "booked":
        db().execute("UPDATE bookings SET status='checked_in' WHERE id=?", (bid,))
    elif action == "checkout" and b["status"] == "checked_in":
        total = nights(b["check_in"], b["check_out"]) * b["price"]
        db().execute("UPDATE bookings SET status='checked_out', total=? WHERE id=?", (total, bid))
        db().commit()
        return redirect(url_for("invoice", bid=bid))
    elif action == "cancel" and b["status"] == "booked":
        db().execute("UPDATE bookings SET status='cancelled' WHERE id=?", (bid,))
    db().commit()
    return redirect(url_for("bookings"))


@app.route("/invoice/<int:bid>")
@login_required
def invoice(bid):
    b = db().execute(
        "SELECT b.*, g.name AS guest, g.email, r.number AS room, r.type, r.price FROM bookings b "
        "JOIN guests g ON g.id=b.guest_id JOIN rooms r ON r.id=b.room_id WHERE b.id=?", (bid,)).fetchone()
    if not b:
        return redirect(url_for("bookings"))
    n = nights(b["check_in"], b["check_out"])
    sub = n * b["price"]
    return render_template("invoice.html", b=b, n=n, sub=sub, tax=sub * TAX, total=sub * (1 + TAX), rate=int(TAX * 100))


init_db()
if __name__ == "__main__":
    app.run(debug=True)

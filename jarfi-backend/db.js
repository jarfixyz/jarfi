const Database = require('better-sqlite3')
const path = require('path')

// Railway mounts a persistent volume at /data if configured,
// otherwise falls back to local file (fine for dev and hackathon without volume).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'jarfi.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id          TEXT PRIMARY KEY,
    jar_pubkey  TEXT NOT NULL,
    owner_pubkey TEXT NOT NULL,
    amount_usdc INTEGER NOT NULL,
    frequency   TEXT NOT NULL,
    day         INTEGER NOT NULL,
    hour        INTEGER NOT NULL,
    minute      INTEGER NOT NULL,
    cron_expr   TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL,
    last_fired  INTEGER
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    owner_pubkey TEXT PRIMARY KEY,
    subscription TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    jar_pubkey              TEXT PRIMARY KEY,
    trip_name               TEXT NOT NULL,
    destination_emoji       TEXT NOT NULL DEFAULT '✈️',
    trip_date               INTEGER NOT NULL,
    budget_per_person_cents INTEGER NOT NULL,
    created_at              INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trip_members (
    jar_pubkey   TEXT NOT NULL,
    owner_pubkey TEXT NOT NULL,
    nickname     TEXT NOT NULL,
    joined_at    INTEGER NOT NULL,
    PRIMARY KEY (jar_pubkey, owner_pubkey)
  );
`)

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

const insertSchedule = db.prepare(`
  INSERT INTO schedules (id, jar_pubkey, owner_pubkey, amount_usdc, frequency, day, hour, minute, cron_expr, active, created_at)
  VALUES (@id, @jar_pubkey, @owner_pubkey, @amount_usdc, @frequency, @day, @hour, @minute, @cron_expr, 1, @created_at)
`)

const selectSchedulesByOwner = db.prepare(`
  SELECT * FROM schedules WHERE owner_pubkey = ? AND active = 1
`)

const deactivateSchedule = db.prepare(`
  UPDATE schedules SET active = 0 WHERE id = ?
`)

const selectActiveSchedules = db.prepare(`
  SELECT * FROM schedules WHERE active = 1
`)

const updateLastFired = db.prepare(`
  UPDATE schedules SET last_fired = ? WHERE id = ?
`)

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------

const upsertPushSub = db.prepare(`
  INSERT INTO push_subscriptions (owner_pubkey, subscription)
  VALUES (@owner_pubkey, @subscription)
  ON CONFLICT(owner_pubkey) DO UPDATE SET subscription = excluded.subscription
`)

const selectPushSub = db.prepare(`
  SELECT subscription FROM push_subscriptions WHERE owner_pubkey = ?
`)

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

const insertTrip = db.prepare(`
  INSERT OR REPLACE INTO trips (jar_pubkey, trip_name, destination_emoji, trip_date, budget_per_person_cents, created_at)
  VALUES (@jar_pubkey, @trip_name, @destination_emoji, @trip_date, @budget_per_person_cents, @created_at)
`)

const insertTripMember = db.prepare(`
  INSERT OR IGNORE INTO trip_members (jar_pubkey, owner_pubkey, nickname, joined_at)
  VALUES (@jar_pubkey, @owner_pubkey, @nickname, @joined_at)
`)

const selectTrip = db.prepare(`
  SELECT * FROM trips WHERE jar_pubkey = ?
`)

const selectTripMembers = db.prepare(`
  SELECT * FROM trip_members WHERE jar_pubkey = ?
`)

const selectTripsByOwner = db.prepare(`
  SELECT DISTINCT t.* FROM trips t
  JOIN trip_members m ON m.jar_pubkey = t.jar_pubkey
  WHERE m.owner_pubkey = ?
`)

// ---------------------------------------------------------------------------
// Exported API — same signatures as the old JSON-based services
// ---------------------------------------------------------------------------

module.exports = {
  // Schedules
  addScheduleRow(row) { return insertSchedule.run(row) },
  getSchedulesByOwner(owner_pubkey) { return selectSchedulesByOwner.all(owner_pubkey) },
  deactivateSchedule(id) { return deactivateSchedule.run(id).changes > 0 },
  getActiveSchedules() { return selectActiveSchedules.all() },
  markScheduleFired(id) { updateLastFired.run(Date.now(), id) },

  // Push subscriptions
  savePushSub(owner_pubkey, subscription) {
    upsertPushSub.run({ owner_pubkey, subscription: JSON.stringify(subscription) })
  },
  getPushSub(owner_pubkey) {
    const row = selectPushSub.get(owner_pubkey)
    return row ? JSON.parse(row.subscription) : null
  },

  // Trips
  createTripRow(trip) { insertTrip.run(trip) },
  addTripMember(member) { insertTripMember.run(member) },
  getTrip(jar_pubkey) {
    const trip = selectTrip.get(jar_pubkey)
    if (!trip) return null
    trip.members = selectTripMembers.all(jar_pubkey)
    return trip
  },
  getTripsByOwner(owner_pubkey) {
    const trips = selectTripsByOwner.all(owner_pubkey)
    return trips.map(t => ({ ...t, members: selectTripMembers.all(t.jar_pubkey) }))
  },
}

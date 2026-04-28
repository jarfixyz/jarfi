const db = require('./db')

function createGroup({ jar_pubkey, trip_name, destination_emoji, trip_date, budget_per_person_cents, owner_pubkey, owner_nickname }) {
  db.createTripRow({
    jar_pubkey,
    trip_name,
    destination_emoji: destination_emoji || '✈️',
    trip_date,
    budget_per_person_cents,
    created_at: Date.now(),
  })
  db.addTripMember({
    jar_pubkey,
    owner_pubkey,
    nickname: owner_nickname || owner_pubkey.slice(0, 6),
    joined_at: Date.now(),
  })
  return db.getTrip(jar_pubkey)
}

function getGroup(jar_pubkey) {
  return db.getTrip(jar_pubkey)
}

function joinGroup({ jar_pubkey, owner_pubkey, nickname }) {
  const trip = db.getTrip(jar_pubkey)
  if (!trip) return null
  db.addTripMember({
    jar_pubkey,
    owner_pubkey,
    nickname: nickname || owner_pubkey.slice(0, 6),
    joined_at: Date.now(),
  })
  return db.getTrip(jar_pubkey)
}

function listGroupsByOwner(owner_pubkey) {
  return db.getTripsByOwner(owner_pubkey)
}

module.exports = { createGroup, getGroup, joinGroup, listGroupsByOwner }

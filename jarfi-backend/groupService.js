const fs = require('fs')
const path = require('path')

const TRIPS_FILE = path.join(__dirname, 'trips.json')

function loadTrips() {
  try { return JSON.parse(fs.readFileSync(TRIPS_FILE, 'utf8')) }
  catch { return {} }
}

function saveTrips(data) {
  fs.writeFileSync(TRIPS_FILE, JSON.stringify(data, null, 2))
}

function createGroup({ jar_pubkey, trip_name, destination_emoji, trip_date, budget_per_person_cents, owner_pubkey, owner_nickname }) {
  const trips = loadTrips()
  trips[jar_pubkey] = {
    jar_pubkey,
    trip_name,
    destination_emoji: destination_emoji || '✈️',
    trip_date,
    budget_per_person_cents,
    created_at: Date.now(),
    members: [
      { pubkey: owner_pubkey, nickname: owner_nickname || owner_pubkey.slice(0, 6), joined_at: Date.now() }
    ],
  }
  saveTrips(trips)
  return trips[jar_pubkey]
}

function getGroup(jar_pubkey) {
  return loadTrips()[jar_pubkey] || null
}

function joinGroup({ jar_pubkey, owner_pubkey, nickname }) {
  const trips = loadTrips()
  const group = trips[jar_pubkey]
  if (!group) return null
  if (group.members.find(m => m.pubkey === owner_pubkey)) return group
  group.members.push({ pubkey: owner_pubkey, nickname: nickname || owner_pubkey.slice(0, 6), joined_at: Date.now() })
  saveTrips(trips)
  return group
}

function listGroupsByOwner(owner_pubkey) {
  const trips = loadTrips()
  return Object.values(trips).filter(g => g.members.some(m => m.pubkey === owner_pubkey))
}

module.exports = { createGroup, getGroup, joinGroup, listGroupsByOwner }

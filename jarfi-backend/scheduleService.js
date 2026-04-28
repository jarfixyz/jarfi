const fs = require('fs')
const path = require('path')
const cron = require('node-cron')
const crypto = require('crypto')

const SCHEDULES_FILE = path.join(__dirname, 'schedules.json')
const SUBS_FILE = path.join(__dirname, 'push-subscriptions.json')

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { return fallback }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// ---------------------------------------------------------------------------
// Cron expression builder
// ---------------------------------------------------------------------------

// frequency: "weekly" | "monthly"
// day:  weekly = 0-6 (Sun=0), monthly = 1-28
// hour, minute: 0-23, 0-59
function buildCron({ frequency, day, hour, minute }) {
  if (frequency === 'weekly')  return `${minute} ${hour} * * ${day}`
  if (frequency === 'monthly') return `${minute} ${hour} ${day} * *`
  throw new Error('frequency must be weekly or monthly')
}

// ---------------------------------------------------------------------------
// Schedule CRUD
// ---------------------------------------------------------------------------

function addSchedule({ jar_pubkey, owner_pubkey, amount_usdc, frequency, day, hour, minute }) {
  const schedules = loadJson(SCHEDULES_FILE, [])
  const id = crypto.randomUUID()
  const cron_expr = buildCron({ frequency, day, hour, minute })
  const schedule = {
    id,
    jar_pubkey,
    owner_pubkey,
    amount_usdc,       // USD cents (integer) — e.g. 1000 = $10.00
    frequency,
    day,
    hour,
    minute,
    cron_expr,
    active: true,
    created_at: Date.now(),
    last_fired: null,
  }
  schedules.push(schedule)
  saveJson(SCHEDULES_FILE, schedules)
  return schedule
}

function getSchedulesByOwner(owner_pubkey) {
  return loadJson(SCHEDULES_FILE, []).filter(
    s => s.owner_pubkey === owner_pubkey && s.active
  )
}

function deleteSchedule(id) {
  const schedules = loadJson(SCHEDULES_FILE, [])
  const idx = schedules.findIndex(s => s.id === id)
  if (idx === -1) return false
  schedules[idx].active = false
  saveJson(SCHEDULES_FILE, schedules)
  return true
}

function markFired(id) {
  const schedules = loadJson(SCHEDULES_FILE, [])
  const s = schedules.find(s => s.id === id)
  if (s) { s.last_fired = Date.now(); saveJson(SCHEDULES_FILE, schedules) }
}

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------

function savePushSubscription(owner_pubkey, subscription) {
  const subs = loadJson(SUBS_FILE, {})
  subs[owner_pubkey] = subscription
  saveJson(SUBS_FILE, subs)
}

function getPushSubscription(owner_pubkey) {
  return loadJson(SUBS_FILE, {})[owner_pubkey] || null
}

// ---------------------------------------------------------------------------
// Cron runner
// ---------------------------------------------------------------------------

// onFire(schedule, subscription|null) — called when a schedule is due.
// Runs every minute; node-cron checks each active schedule's cron_expr.
function startCronRunner(onFire) {
  const activeTasks = new Map()

  function syncTasks() {
    const schedules = loadJson(SCHEDULES_FILE, []).filter(s => s.active)

    // Remove tasks for deleted/inactive schedules
    for (const [id, task] of activeTasks) {
      if (!schedules.find(s => s.id === id)) {
        task.stop()
        activeTasks.delete(id)
      }
    }

    // Add tasks for new schedules
    for (const schedule of schedules) {
      if (activeTasks.has(schedule.id)) continue
      if (!cron.validate(schedule.cron_expr)) {
        console.warn(`[schedule] invalid cron for ${schedule.id}: ${schedule.cron_expr}`)
        continue
      }
      const task = cron.schedule(schedule.cron_expr, () => {
        const sub = getPushSubscription(schedule.owner_pubkey)
        console.log(`[schedule] firing ${schedule.id} (${schedule.jar_pubkey}) sub=${!!sub}`)
        markFired(schedule.id)
        onFire(schedule, sub)
      })
      activeTasks.set(schedule.id, task)
      console.log(`[schedule] registered ${schedule.id} cron="${schedule.cron_expr}"`)
    }
  }

  // Sync on startup and every 60s to pick up new schedules added via API
  syncTasks()
  setInterval(syncTasks, 60_000)
}

module.exports = {
  addSchedule,
  getSchedulesByOwner,
  deleteSchedule,
  savePushSubscription,
  getPushSubscription,
  startCronRunner,
}

const cron = require('node-cron')
const crypto = require('crypto')
const db = require('./db')

// ---------------------------------------------------------------------------
// Cron expression builder
// ---------------------------------------------------------------------------

function buildCron({ frequency, day, hour, minute }) {
  if (frequency === 'weekly')  return `${minute} ${hour} * * ${day}`
  if (frequency === 'monthly') return `${minute} ${hour} ${day} * *`
  throw new Error('frequency must be weekly or monthly')
}

// ---------------------------------------------------------------------------
// Schedule CRUD
// ---------------------------------------------------------------------------

function addSchedule({ jar_pubkey, owner_pubkey, amount_usdc, frequency, day, hour, minute }) {
  const id = crypto.randomUUID()
  const cron_expr = buildCron({ frequency, day, hour, minute })
  const row = {
    id, jar_pubkey, owner_pubkey,
    amount_usdc, frequency, day, hour, minute,
    cron_expr, created_at: Date.now(),
  }
  db.addScheduleRow(row)
  return { ...row, active: true, last_fired: null }
}

function getSchedulesByOwner(owner_pubkey) {
  return db.getSchedulesByOwner(owner_pubkey).map(r => ({ ...r, active: !!r.active }))
}

function deleteSchedule(id) {
  return db.deactivateSchedule(id)
}

function markFired(id) {
  db.markScheduleFired(id)
}

// ---------------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------------

function savePushSubscription(owner_pubkey, subscription) {
  db.savePushSub(owner_pubkey, subscription)
}

function getPushSubscription(owner_pubkey) {
  return db.getPushSub(owner_pubkey)
}

// ---------------------------------------------------------------------------
// Cron runner — same API as before
// ---------------------------------------------------------------------------

function startCronRunner(onFire) {
  const activeTasks = new Map()

  function syncTasks() {
    const schedules = db.getActiveSchedules()

    for (const [id, task] of activeTasks) {
      if (!schedules.find(s => s.id === id)) {
        task.stop()
        activeTasks.delete(id)
      }
    }

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

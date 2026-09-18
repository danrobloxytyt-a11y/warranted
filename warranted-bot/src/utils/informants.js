const db = require('../database');

const TICK_MS = 60_000; // check every minute whether any timer is due

function startInformantTimers(client) {
  setInterval(async () => {
    const now = Date.now();
    const timers = db.prepare('SELECT * FROM informant_timers').all();

    for (const timer of timers) {
      if (now - timer.last_sent_at < timer.interval_ms) continue;

      const channel = client.channels.cache.get(timer.channel_id);
      if (!channel) continue;

      await channel.send({ content: timer.message }).catch(err =>
        console.error(`Failed to send timed message (timer #${timer.id}):`, err.message)
      );

      db.prepare('UPDATE informant_timers SET last_sent_at = ? WHERE id = ?').run(now, timer.id);
    }
  }, TICK_MS);

  console.log('[WARRANTED] Informant timer scheduler started (1 tick per minute).');
}

module.exports = { startInformantTimers };

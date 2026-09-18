const db = require('../database');

async function sendLog(guild, embed) {
  const row = db.prepare('SELECT log_channel FROM guild_config WHERE guild_id = ?').get(guild.id);
  if (!row || !row.log_channel) return;
  const channel = guild.channels.cache.get(row.log_channel);
  if (!channel) return;
  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to send log:', err.message);
  }
}

module.exports = { sendLog };

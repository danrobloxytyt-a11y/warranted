const config = require('../config');
const db = require('../database');
const { sendLog } = require('./log');

const MESSAGE_COOLDOWN_MS = 60_000; // 1 minute between text XP gains per user

// Core XP grant, shared by text messages and voice ticks. Handles the DB
// write, level-up detection, role reward application, and announcing the
// promotion wherever makes sense for the source.
async function addXp(member, amount, { announceChannel = null } = {}) {
  const guildId = member.guild.id;
  const userId = member.id;

  const row = db.prepare('SELECT xp FROM levels WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);

  const oldXp = row ? row.xp : 0;
  const oldLevel = config.levelFromXp(oldXp);
  const newXp = oldXp + amount;
  const newLevel = config.levelFromXp(newXp);

  db.prepare(`
    INSERT INTO levels (guild_id, user_id, xp) VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = excluded.xp
  `).run(guildId, userId, newXp);

  if (newLevel > oldLevel) {
    await applyLevelRewards(member, newXp);

    const promoText = `🎖️ ${member} has been promoted to **Level ${newLevel}**.`;
    if (announceChannel) {
      announceChannel.send({ content: promoText }).catch(() => {});
    } else {
      // Voice-driven level-ups have no natural text channel, so they go to
      // the wiretap log instead of interrupting a random channel.
      sendLog(member.guild, {
        color: config.colors.silver,
        title: '🎖️ PROMOTION',
        description: promoText
      }).catch(() => {});
    }
  }

  return newXp;
}

async function grantMessageXp(message) {
  if (message.author.bot || !message.guild || !message.member) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  const row = db.prepare('SELECT last_message_at FROM levels WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);

  const now = Date.now();
  if (row && row.last_message_at && now - row.last_message_at < MESSAGE_COOLDOWN_MS) return;

  await addXp(message.member, config.xpPerMessage(), { announceChannel: message.channel });

  db.prepare('UPDATE levels SET last_message_at = ? WHERE guild_id = ? AND user_id = ?')
    .run(now, guildId, userId);
}

// Called once per tracking tick (see vc.js) for each member currently
// eligible for voice XP. No cooldown needed here since the tick interval
// itself sets the cadence.
async function grantVoiceXp(member) {
  await addXp(member, config.xpPerVoiceMinute(), { announceChannel: null });
}

async function applyLevelRewards(member, xp) {
  const level = config.levelFromXp(xp);
  const rewards = db.prepare('SELECT level, role_id FROM level_rewards WHERE guild_id = ? AND level <= ?')
    .all(member.guild.id, level);

  for (const reward of rewards) {
    if (!member.roles.cache.has(reward.role_id)) {
      await member.roles.add(reward.role_id).catch(() => {});
    }
  }
}

module.exports = { addXp, grantMessageXp, grantVoiceXp, applyLevelRewards };

const db = require('../database');
const { baseEmbed } = require('./embeds');
const config = require('../config');

const DEFAULT_THRESHOLD = 5;

function emojiKey(emoji) {
  return emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name;
}

function getConfig(guildId) {
  return db.prepare('SELECT evidence_channel, evidence_emoji, evidence_threshold FROM guild_config WHERE guild_id = ?')
    .get(guildId);
}

// Counts reactions of the configured emoji, excluding the message author's
// own reaction and any bot reactions — self-starring your own message
// shouldn't count toward getting it on the board.
async function countRealReactions(reaction, message) {
  const users = await reaction.users.fetch().catch(() => null);
  if (!users) return reaction.count || 0;

  let count = 0;
  for (const user of users.values()) {
    if (user.bot) continue;
    if (user.id === message.author.id) continue;
    count++;
  }
  return count;
}

function buildBoardEmbed(message, count, emoji) {
  const embed = baseEmbed(config.colors.black)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content?.slice(0, 4000) || '*No text content.*')
    .addFields({ name: 'Source', value: `[Jump to message](${message.url})` })
    .setFooter({ text: `${count} ${typeof emoji === 'string' ? emoji : ''}  •  #${message.channel.name}` })
    .setTimestamp(message.createdTimestamp);

  const image = message.attachments.find(a => a.contentType?.startsWith('image/'));
  if (image) embed.setImage(image.url);

  return embed;
}

async function handleReactionChange(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message || !message.guild) return;

  const cfg = getConfig(message.guild.id);
  if (!cfg?.evidence_channel || !cfg?.evidence_emoji) return;
  if (emojiKey(reaction.emoji) !== cfg.evidence_emoji) return;

  const threshold = cfg.evidence_threshold || DEFAULT_THRESHOLD;
  const count = await countRealReactions(reaction, message);

  const existing = db.prepare('SELECT * FROM evidence_board WHERE original_message_id = ?').get(message.id);

  if (existing) {
    // Already posted — just keep the count on the board post current.
    const boardChannel = message.guild.channels.cache.get(cfg.evidence_channel);
    const boardMessage = boardChannel ? await boardChannel.messages.fetch(existing.board_message_id).catch(() => null) : null;
    if (boardMessage) {
      const embed = buildBoardEmbed(message, count, cfg.evidence_emoji);
      await boardMessage.edit({ embeds: [embed] }).catch(() => {});
    }
    db.prepare('UPDATE evidence_board SET reaction_count = ? WHERE original_message_id = ?').run(count, message.id);
    return;
  }

  if (count < threshold) return; // not enough yet, and not posted — nothing to do

  const boardChannel = message.guild.channels.cache.get(cfg.evidence_channel);
  if (!boardChannel) return;

  const embed = buildBoardEmbed(message, count, cfg.evidence_emoji);
  const boardMessage = await boardChannel.send({ embeds: [embed] }).catch(() => null);
  if (!boardMessage) return;

  db.prepare(`
    INSERT INTO evidence_board (original_message_id, board_message_id, guild_id, channel_id, reaction_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(message.id, boardMessage.id, message.guild.id, message.channel.id, count);
}

module.exports = { handleReactionChange, emojiKey, DEFAULT_THRESHOLD };

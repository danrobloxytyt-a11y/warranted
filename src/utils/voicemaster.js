const db = require('../database');

// Returns the temp_voice_channels row for a channel, or null if it isn't one.
function getTempChannel(channelId) {
  return db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?').get(channelId);
}

// Checks the interaction's author is currently sitting in a temp VC they own.
// Returns { ok: true, channel, row } or { ok: false, reason }.
function requireOwnedTempChannel(interaction) {
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return { ok: false, reason: 'You need to be in a voice channel to use this.' };
  }

  const row = getTempChannel(voiceChannel.id);
  if (!row) {
    return { ok: false, reason: 'This only works inside a temporary voice channel created by VoiceMaster.' };
  }

  if (row.owner_id !== interaction.user.id) {
    return { ok: false, reason: `Only <@${row.owner_id}> owns this channel. Use \`/voicemaster claim\` if they've left.` };
  }

  return { ok: true, channel: voiceChannel, row };
}

module.exports = { getTempChannel, requireOwnedTempChannel };

const { ChannelType } = require('discord.js');
const { grantVoiceXp } = require('./leveling');

const TICK_MS = 60_000; // award VC xp once per minute

// A member is considered genuinely "present" (not AFK) for VC xp if ALL of
// these hold:
//   1. They are not a bot.
//   2. The channel is not the server's designated AFK channel.
//   3. They are not server-deafened or self-deafened (deafened == not
//      actually listening, treated as away from keyboard).
//   4. There are at least 2 non-bot humans in the channel — a single person
//      sitting alone in a VC (deafened or not) doesn't earn xp, since that's
//      the easiest way to passively farm levels overnight.
function isEligible(member, humanCountInChannel) {
  if (member.user.bot) return false;
  if (member.voice.channelId === member.guild.afkChannelId) return false;
  if (member.voice.deaf || member.voice.selfDeaf) return false;
  if (humanCountInChannel < 2) return false;
  return true;
}

function startVoiceXpTracker(client) {
  setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      const voiceChannels = guild.channels.cache.filter(
        c => c.type === ChannelType.GuildVoice && c.members.size > 0
      );

      for (const channel of voiceChannels.values()) {
        const humanMembers = channel.members.filter(m => !m.user.bot);
        const humanCount = humanMembers.size;

        for (const member of humanMembers.values()) {
          if (isEligible(member, humanCount)) {
            grantVoiceXp(member).catch(err =>
              console.error(`VC xp grant failed for ${member.id}:`, err.message)
            );
          }
        }
      }
    }
  }, TICK_MS);

  console.log('[WARRANTED] Voice XP tracker started (1 tick per minute).');
}

module.exports = { startVoiceXpTracker };

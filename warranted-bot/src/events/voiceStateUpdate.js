const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../database');

async function handleJoin(newState) {
  const guildId = newState.guild.id;
  const cfg = db.prepare('SELECT vm_join_channel FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!cfg?.vm_join_channel) return;
  if (newState.channelId !== cfg.vm_join_channel) return;

  const member = newState.member;
  const triggerChannel = newState.channel;

  const channelName = `🔒 ${member.user.username}'s Hideout`.slice(0, 100);

  const tempChannel = await newState.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: triggerChannel.parentId || null,
    permissionOverwrites: [
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      }
    ]
  }).catch(err => {
    console.error('Failed to create temp voice channel:', err.message);
    return null;
  });

  if (!tempChannel) return;

  await member.voice.setChannel(tempChannel).catch(err => {
    console.error('Failed to move member into temp channel:', err.message);
  });

  db.prepare('INSERT INTO temp_voice_channels (channel_id, guild_id, owner_id, created_at) VALUES (?, ?, ?, ?)')
    .run(tempChannel.id, guildId, member.id, Date.now());
}

async function handleLeave(oldState) {
  const channel = oldState.channel;
  if (!channel) return;

  const row = db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?').get(channel.id);
  if (!row) return;

  // Refetch to get an accurate member count post-departure.
  const freshChannel = await oldState.guild.channels.fetch(channel.id).catch(() => null);
  if (!freshChannel) {
    db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(channel.id);
    return;
  }

  if (freshChannel.members.size === 0) {
    await freshChannel.delete().catch(() => {});
    db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(channel.id);
  }
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      await handleJoin(newState);
    }
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      await handleLeave(oldState);
    }
  }
};

const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { requireOwnedTempChannel } = require('../../utils/voicemaster');
const db = require('../../database');

function upsertConfig(guildId, fields) {
  const existing = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!existing) {
    db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(guildId);
  }
  const setClause = Object.keys(fields).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE guild_config SET ${setClause} WHERE guild_id = @guild_id`)
    .run({ ...fields, guild_id: guildId });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicemaster')
    .setDescription('Join-to-create temporary voice channels.')
    .addSubcommand(sc => sc
      .setName('setup')
      .setDescription('(Staff) Set or create the join-to-create trigger channel')
      .addChannelOption(o => o.setName('channel')
        .setDescription('An existing voice channel to use as the trigger. Leave blank to create one.')
        .addChannelTypes(ChannelType.GuildVoice)))
    .addSubcommand(sc => sc.setName('lock').setDescription('Lock your temp channel (deny new joins)'))
    .addSubcommand(sc => sc.setName('unlock').setDescription('Unlock your temp channel'))
    .addSubcommand(sc => sc
      .setName('limit')
      .setDescription('Set a user limit on your temp channel')
      .addIntegerOption(o => o.setName('number').setDescription('0 for unlimited, 1-99 otherwise').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('rename')
      .setDescription('Rename your temp channel')
      .addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)))
    .addSubcommand(sc => sc.setName('claim').setDescription('Claim ownership if the original owner left'))
    .addSubcommand(sc => sc
      .setName('kick')
      .setDescription('Disconnect someone from your temp channel')
      .addUserOption(o => o.setName('user').setDescription('User to disconnect').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('invite')
      .setDescription('Let a specific user connect even while locked')
      .addUserOption(o => o.setName('user').setDescription('User to allow').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [errorEmbed('ACCESS DENIED', 'You need Manage Server permission to run this.')],
          ephemeral: true
        });
      }

      let channel = interaction.options.getChannel('channel');
      if (!channel) {
        channel = await interaction.guild.channels.create({
          name: '➕ Join to Create',
          type: ChannelType.GuildVoice,
          parent: interaction.channel.parentId || null
        });
      }

      upsertConfig(interaction.guild.id, { vm_join_channel: channel.id });
      return interaction.reply({
        embeds: [successEmbed('VOICEMASTER READY', `Joining ${channel} now spins up a personal temp channel.`)],
        ephemeral: true
      });
    }

    if (sub === 'lock') {
      const result = requireOwnedTempChannel(interaction);
      if (!result.ok) return interaction.reply({ embeds: [errorEmbed('CANNOT LOCK', result.reason)], ephemeral: true });

      await result.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      return interaction.reply({ embeds: [successEmbed('LOCKED', 'Your channel is now invite-only. Use `/voicemaster invite` to let someone in.')] });
    }

    if (sub === 'unlock') {
      const result = requireOwnedTempChannel(interaction);
      if (!result.ok) return interaction.reply({ embeds: [errorEmbed('CANNOT UNLOCK', result.reason)], ephemeral: true });

      await result.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
      return interaction.reply({ embeds: [successEmbed('UNLOCKED', 'Anyone can join your channel again.')] });
    }

    if (sub === 'limit') {
      const result = requireOwnedTempChannel(interaction);
      if (!result.ok) return interaction.reply({ embeds: [errorEmbed('CANNOT SET LIMIT', result.reason)], ephemeral: true });

      const number = interaction.options.getInteger('number');
      if (number < 0 || number > 99) {
        return interaction.reply({ embeds: [errorEmbed('INVALID LIMIT', 'Use a number between 0 (unlimited) and 99.')], ephemeral: true });
      }
      await result.channel.setUserLimit(number);
      return interaction.reply({ embeds: [successEmbed('LIMIT SET', number === 0 ? 'Unlimited members can now join.' : `Limit set to ${number}.`)] });
    }

    if (sub === 'rename') {
      const result = requireOwnedTempChannel(interaction);
      if (!result.ok) return interaction.reply({ embeds: [errorEmbed('CANNOT RENAME', result.reason)], ephemeral: true });

      const name = interaction.options.getString('name').slice(0, 100);
      await result.channel.setName(name);
      return interaction.reply({ embeds: [successEmbed('RENAMED', `Channel is now called **${name}**.`)] });
    }

    if (sub === 'claim') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        return interaction.reply({ embeds: [errorEmbed('CANNOT CLAIM', 'You need to be in the channel to claim it.')], ephemeral: true });
      }
      const row = db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?').get(voiceChannel.id);
      if (!row) {
        return interaction.reply({ embeds: [errorEmbed('NOT A TEMP CHANNEL', 'This is not a VoiceMaster channel.')], ephemeral: true });
      }
      const ownerStillHere = voiceChannel.members.has(row.owner_id);
      if (ownerStillHere) {
        return interaction.reply({ embeds: [errorEmbed('CANNOT CLAIM', `<@${row.owner_id}> is still in the channel.`)], ephemeral: true });
      }
      db.prepare('UPDATE temp_voice_channels SET owner_id = ? WHERE channel_id = ?').run(interaction.user.id, voiceChannel.id);
      return interaction.reply({ embeds: [successEmbed('CLAIMED', `${interaction.user} is now the owner of this channel.`)] });
    }

    if (sub === 'kick') {
      const result = requireOwnedTempChannel(interaction);
      if (!result.ok) return interaction.reply({ embeds: [errorEmbed('CANNOT KICK', result.reason)], ephemeral: true });

      const user = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member?.voice.channelId === result.channel.id) {
        await member.voice.disconnect().catch(() => {});
      }
      return interaction.reply({ embeds: [successEmbed('DISCONNECTED', `${user} was removed from your channel.`)] });
    }

    if (sub === 'invite') {
      const result = requireOwnedTempChannel(interaction);
      if (!result.ok) return interaction.reply({ embeds: [errorEmbed('CANNOT INVITE', result.reason)], ephemeral: true });

      const user = interaction.options.getUser('user');
      await result.channel.permissionOverwrites.edit(user.id, { Connect: true });
      return interaction.reply({ embeds: [successEmbed('INVITED', `${user} can now join even while locked.`)] });
    }
  }
};

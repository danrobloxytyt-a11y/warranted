const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { successEmbed, errorEmbed, baseEmbed } = require('../../utils/embeds');
const { parseDuration } = require('../../utils/duration');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('informant')
    .setDescription('Manage auto-responders and timed messages.')
    .addSubcommand(sc => sc
      .setName('triggeradd')
      .setDescription('Auto-reply when a message contains a phrase')
      .addStringOption(o => o.setName('trigger').setDescription('Phrase to watch for (case-insensitive)').setRequired(true))
      .addStringOption(o => o.setName('response').setDescription('What the bot replies with').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('triggerremove')
      .setDescription('Remove an auto-responder by ID')
      .addIntegerOption(o => o.setName('id').setDescription('ID from /informant triggerlist').setRequired(true)))
    .addSubcommand(sc => sc.setName('triggerlist').setDescription('List all auto-responders'))
    .addSubcommand(sc => sc
      .setName('timeradd')
      .setDescription('Post a recurring message on a schedule')
      .addChannelOption(o => o.setName('channel')
        .setDescription('Channel to post in')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message to post').setRequired(true))
      .addStringOption(o => o.setName('interval').setDescription('e.g. 30m, 1h, 6h, 1d').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('timerremove')
      .setDescription('Remove a timed message by ID')
      .addIntegerOption(o => o.setName('id').setDescription('ID from /informant timerlist').setRequired(true)))
    .addSubcommand(sc => sc.setName('timerlist').setDescription('List all timed messages'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'triggeradd') {
      const trigger = interaction.options.getString('trigger');
      const response = interaction.options.getString('response');
      db.prepare('INSERT INTO informant_triggers (guild_id, trigger, response) VALUES (?, ?, ?)')
        .run(guildId, trigger, response);
      return interaction.reply({
        embeds: [successEmbed('TRIGGER ADDED', `Messages containing **"${trigger}"** now get an automatic reply.`)],
        ephemeral: true
      });
    }

    if (sub === 'triggerremove') {
      const id = interaction.options.getInteger('id');
      const result = db.prepare('DELETE FROM informant_triggers WHERE id = ? AND guild_id = ?').run(id, guildId);
      if (result.changes === 0) {
        return interaction.reply({ embeds: [errorEmbed('NOT FOUND', `No trigger with ID ${id}.`)], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed('TRIGGER REMOVED', `Trigger #${id} deleted.`)], ephemeral: true });
    }

    if (sub === 'triggerlist') {
      const rows = db.prepare('SELECT * FROM informant_triggers WHERE guild_id = ?').all(guildId);
      const embed = baseEmbed(config.colors.black).setTitle('AUTO-RESPONDERS');
      embed.setDescription(rows.length
        ? rows.map(r => `**#${r.id}** \`${r.trigger}\` → ${r.response.slice(0, 60)}${r.response.length > 60 ? '…' : ''}`).join('\n')
        : 'No auto-responders configured.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'timeradd') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const intervalInput = interaction.options.getString('interval');

      const intervalMs = parseDuration(intervalInput);
      if (!intervalMs || intervalMs < 60_000) {
        return interaction.reply({
          embeds: [errorEmbed('INVALID INTERVAL', 'Use a format like `30m`, `1h`, `6h`, or `1d` (minimum 1 minute).')],
          ephemeral: true
        });
      }

      db.prepare('INSERT INTO informant_timers (guild_id, channel_id, message, interval_ms, last_sent_at) VALUES (?, ?, ?, ?, ?)')
        .run(guildId, channel.id, message, intervalMs, 0);

      return interaction.reply({
        embeds: [successEmbed('TIMER ADDED', `${channel} will get this message every **${intervalInput}**, starting within the next minute.`)],
        ephemeral: true
      });
    }

    if (sub === 'timerremove') {
      const id = interaction.options.getInteger('id');
      const result = db.prepare('DELETE FROM informant_timers WHERE id = ? AND guild_id = ?').run(id, guildId);
      if (result.changes === 0) {
        return interaction.reply({ embeds: [errorEmbed('NOT FOUND', `No timer with ID ${id}.`)], ephemeral: true });
      }
      return interaction.reply({ embeds: [successEmbed('TIMER REMOVED', `Timer #${id} deleted.`)], ephemeral: true });
    }

    if (sub === 'timerlist') {
      const rows = db.prepare('SELECT * FROM informant_timers WHERE guild_id = ?').all(guildId);
      const embed = baseEmbed(config.colors.black).setTitle('TIMED MESSAGES');
      embed.setDescription(rows.length
        ? rows.map(r => `**#${r.id}** <#${r.channel_id}> every ${Math.round(r.interval_ms / 60000)}min → ${r.message.slice(0, 50)}${r.message.length > 50 ? '…' : ''}`).join('\n')
        : 'No timed messages configured.');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

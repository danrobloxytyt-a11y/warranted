const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');
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
    .setName('intake')
    .setDescription('Configure onboarding: welcome, goodbye, autorole, logging.')
    .addSubcommand(sc => sc
      .setName('welcome')
      .setDescription('Set the welcome message')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true))
      .addStringOption(o => o.setName('message')
        .setDescription('Use {user} for mention, {server} for server name')
        .setRequired(true)))
    .addSubcommand(sc => sc
      .setName('goodbye')
      .setDescription('Set the goodbye message')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true))
      .addStringOption(o => o.setName('message')
        .setDescription('Use {user} for username, {server} for server name')
        .setRequired(true)))
    .addSubcommand(sc => sc
      .setName('autorole')
      .setDescription('Set the role auto-assigned on join')
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('logchannel')
      .setDescription('Set the wiretap (moderation log) channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for logs').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'welcome') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      upsertConfig(guildId, { welcome_channel: channel.id, welcome_message: message });
      return interaction.reply({ embeds: [successEmbed('WELCOME SET', `New members will be booked in ${channel}.`)], ephemeral: true });
    }

    if (sub === 'goodbye') {
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      upsertConfig(guildId, { goodbye_channel: channel.id, goodbye_message: message });
      return interaction.reply({ embeds: [successEmbed('GOODBYE SET', `Departures will be logged in ${channel}.`)], ephemeral: true });
    }

    if (sub === 'autorole') {
      const role = interaction.options.getRole('role');
      upsertConfig(guildId, { autorole: role.id });
      return interaction.reply({ embeds: [successEmbed('AUTOROLE SET', `New members will automatically receive ${role}.`)], ephemeral: true });
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('channel');
      upsertConfig(guildId, { log_channel: channel.id });
      return interaction.reply({ embeds: [successEmbed('WIRETAP SET', `Moderation actions will be logged in ${channel}.`)], ephemeral: true });
    }
  }
};

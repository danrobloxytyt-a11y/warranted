const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed } = require('../../utils/embeds');
const { refreshPanelMessage } = require('../../utils/tickets');
const config = require('../../config');
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
    .setName('casefile')
    .setDescription('Configure the Case Files (ticket) system.')
    .addSubcommand(sc => sc
      .setName('panelcreate')
      .setDescription('Post a new case-opening panel in this channel')
      .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('optionadd')
      .setDescription('Add a case type button to a panel')
      .addStringOption(o => o.setName('panel_message_id').setDescription('The panel message ID').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Button label, e.g. Report').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji for the button')))
    .addSubcommand(sc => sc
      .setName('optionremove')
      .setDescription('Remove a case type button from a panel')
      .addStringOption(o => o.setName('panel_message_id').setDescription('The panel message ID').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Button label to remove').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('staffrole')
      .setDescription('Set the role that can see and manage all case files')
      .addRoleOption(o => o.setName('role').setDescription('Staff role').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('category')
      .setDescription('Set the category new case file channels are created under')
      .addChannelOption(o => o.setName('category')
        .setDescription('Category channel')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)))
    .addSubcommand(sc => sc
      .setName('transcriptchannel')
      .setDescription('Set a dedicated channel for closed case transcripts (separate from general logs)')
      .addChannelOption(o => o.setName('channel')
        .setDescription('Channel for transcripts')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand(sc => sc
      .setName('blacklistadd')
      .setDescription('Block a user from opening case files')
      .addUserOption(o => o.setName('user').setDescription('User to block').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('blacklistremove')
      .setDescription('Unblock a user')
      .addUserOption(o => o.setName('user').setDescription('User to unblock').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'panelcreate') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');

      const embed = baseEmbed(config.colors.black).setTitle(title).setDescription(description);
      const message = await interaction.channel.send({ embeds: [embed] });

      db.prepare('INSERT INTO ticket_panels (message_id, channel_id, guild_id, title, description) VALUES (?, ?, ?, ?, ?)')
        .run(message.id, interaction.channel.id, guildId, title, description);

      return interaction.reply({
        embeds: [successEmbed('PANEL CREATED', `Message ID: \`${message.id}\`\nUse this ID with \`/casefile optionadd\` to add case types.`)],
        ephemeral: true
      });
    }

    if (sub === 'optionadd') {
      const panelMessageId = interaction.options.getString('panel_message_id');
      const label = interaction.options.getString('label');
      const emoji = interaction.options.getString('emoji');

      const panel = db.prepare('SELECT * FROM ticket_panels WHERE message_id = ?').get(panelMessageId);
      if (!panel) {
        return interaction.reply({ embeds: [errorEmbed('PANEL NOT FOUND', 'No panel exists with that message ID.')], ephemeral: true });
      }

      const count = db.prepare('SELECT COUNT(*) AS c FROM ticket_options WHERE panel_message_id = ?').get(panelMessageId).c;
      if (count >= 5) {
        return interaction.reply({ embeds: [errorEmbed('LIMIT REACHED', 'A panel can have at most 5 case types (Discord button row limit).')], ephemeral: true });
      }

      db.prepare('INSERT INTO ticket_options (panel_message_id, label, emoji) VALUES (?, ?, ?)')
        .run(panelMessageId, label, emoji);

      await refreshPanelMessage(interaction.client, panelMessageId);

      return interaction.reply({ embeds: [successEmbed('OPTION ADDED', `**${label}** added to the panel.`)], ephemeral: true });
    }

    if (sub === 'optionremove') {
      const panelMessageId = interaction.options.getString('panel_message_id');
      const label = interaction.options.getString('label');

      db.prepare('DELETE FROM ticket_options WHERE panel_message_id = ? AND label = ?').run(panelMessageId, label);
      await refreshPanelMessage(interaction.client, panelMessageId);

      return interaction.reply({ embeds: [successEmbed('OPTION REMOVED', `**${label}** removed from the panel.`)], ephemeral: true });
    }

    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role');
      upsertConfig(guildId, { ticket_staff_role: role.id });
      return interaction.reply({ embeds: [successEmbed('STAFF ROLE SET', `${role} can now see and manage all case files.`)], ephemeral: true });
    }

    if (sub === 'category') {
      const category = interaction.options.getChannel('category');
      upsertConfig(guildId, { ticket_category: category.id });
      return interaction.reply({ embeds: [successEmbed('CATEGORY SET', `New case files will be created under **${category.name}**.`)], ephemeral: true });
    }

    if (sub === 'transcriptchannel') {
      const channel = interaction.options.getChannel('channel');
      upsertConfig(guildId, { ticket_transcript_channel: channel.id });
      return interaction.reply({
        embeds: [successEmbed('TRANSCRIPT CHANNEL SET', `Closed case transcripts now post to ${channel} instead of the general wiretap log.`)],
        ephemeral: true
      });
    }

    if (sub === 'blacklistadd') {
      const user = interaction.options.getUser('user');
      db.prepare('INSERT OR IGNORE INTO ticket_blacklist (guild_id, user_id) VALUES (?, ?)').run(guildId, user.id);
      return interaction.reply({ embeds: [successEmbed('BLOCKED', `${user.tag} can no longer open case files.`)], ephemeral: true });
    }

    if (sub === 'blacklistremove') {
      const user = interaction.options.getUser('user');
      db.prepare('DELETE FROM ticket_blacklist WHERE guild_id = ? AND user_id = ?').run(guildId, user.id);
      return interaction.reply({ embeds: [successEmbed('UNBLOCKED', `${user.tag} can open case files again.`)], ephemeral: true });
    }
  }
};

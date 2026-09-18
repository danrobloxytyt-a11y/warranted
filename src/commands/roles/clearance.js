const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, baseEmbed } = require('../../utils/embeds');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearance')
    .setDescription('Manage reaction roles.')
    .addSubcommand(sc => sc
      .setName('add')
      .setDescription('Bind an emoji reaction on a message to a role')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID to watch').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to grant').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('remove')
      .setDescription('Unbind a reaction role')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
    .addSubcommand(sc => sc.setName('list').setDescription('Show all reaction role bindings'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        return interaction.reply({
          embeds: [errorEmbed('MESSAGE NOT FOUND', 'Make sure you run this command in the same channel as the target message.')],
          ephemeral: true
        });
      }

      await message.react(emoji).catch(() => {});

      db.prepare(`
        INSERT INTO reaction_roles (message_id, emoji, role_id, guild_id) VALUES (?, ?, ?, ?)
        ON CONFLICT(message_id, emoji) DO UPDATE SET role_id = excluded.role_id
      `).run(messageId, emoji, role.id, interaction.guild.id);

      return interaction.reply({
        embeds: [successEmbed('🔑 CLEARANCE BOUND', `Reacting with ${emoji} on that message now grants ${role}.`)],
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id');
      const emoji = interaction.options.getString('emoji');
      db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?').run(messageId, emoji);
      return interaction.reply({ embeds: [successEmbed('BINDING REMOVED', 'That reaction role has been unbound.')], ephemeral: true });
    }

    // list
    const rows = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(interaction.guild.id);
    const embed = baseEmbed(config.colors.black).setTitle('🔑 CLEARANCE BINDINGS');
    embed.setDescription(rows.length
      ? rows.map(r => `${r.emoji} on \`${r.message_id}\` → <@&${r.role_id}>`).join('\n')
      : 'No reaction roles configured yet.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

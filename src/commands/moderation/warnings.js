const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { baseEmbed } = require('../../utils/embeds');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("Pull a member's file (citation history).")
    .addUserOption(o => o.setName('user').setDescription('Whose file to pull').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const rows = db.prepare(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC LIMIT 15'
    ).all(interaction.guild.id, target.id);

    const embed = baseEmbed(config.colors.black).setTitle(`📂 FILE: ${target.tag}`);

    if (rows.length === 0) {
      embed.setDescription('Clean record. No citations on file.');
    } else {
      embed.setDescription(
        rows.map((r, i) =>
          `**${i + 1}.** ${r.reason}\n<t:${Math.floor(r.timestamp / 1000)}:R> — issued by <@${r.moderator_id}>`
        ).join('\n\n')
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { caseEmbed, errorEmbed } = require('../../utils/embeds');
const { sendLog } = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Close the case on a member: remove them from the server.')
    .addUserOption(o => o.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban'))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Delete message history (days, 0-7)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({
        embeds: [errorEmbed('CANNOT CLOSE CASE', 'That member outranks me or is not bannable.')],
        ephemeral: true
      });
    }

    await interaction.guild.members.ban(target.id, {
      reason,
      deleteMessageSeconds: deleteDays * 86400
    });

    const embed = caseEmbed({
      title: '🚨 CASE CLOSED',
      target: `${target.tag} (${target.id})`,
      moderator: interaction.user.tag,
      reason
    });

    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.guild, embed);
  }
};

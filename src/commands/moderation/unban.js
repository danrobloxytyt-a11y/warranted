const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { sendLog } = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Reopen a closed case: unban a user by ID.')
    .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    try {
      await interaction.guild.members.unban(userId);
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed('NO CASE FOUND', 'That user is not currently banned, or the ID is invalid.')],
        ephemeral: true
      });
    }
    const embed = successEmbed('📂 CASE REOPENED', `<@${userId}> has been unbanned by ${interaction.user.tag}.`);
    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.guild, embed);
  }
};

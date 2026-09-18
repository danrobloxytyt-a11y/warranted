const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { caseEmbed, errorEmbed } = require('../../utils/embeds');
const { sendLog } = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Escort a member off the property.')
    .addUserOption(o => o.setName('user').setDescription('Who to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('NOT FOUND', 'That user is not in this server.')], ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ embeds: [errorEmbed('CANNOT REMOVE', 'That member outranks me.')], ephemeral: true });
    }

    await member.kick(reason);

    const embed = caseEmbed({
      title: '🚪 ESCORTED OUT',
      target: `${target.tag} (${target.id})`,
      moderator: interaction.user.tag,
      reason
    });

    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.guild, embed);
  }
};

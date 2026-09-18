const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { caseEmbed, errorEmbed, successEmbed } = require('../../utils/embeds');
const { sendLog } = require('../../utils/log');
const { parseDuration } = require('../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Hold a member for questioning (timeout).')
    .addUserOption(o => o.setName('user').setDescription('Who to time out').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription("e.g. 10m, 1h, 1d (max 28d)").setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    const ms = parseDuration(durationInput);
    if (!ms || ms > 28 * 86_400_000) {
      return interaction.reply({
        embeds: [errorEmbed('INVALID DURATION', 'Use a format like `10m`, `1h`, or `1d` (max 28 days).')],
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('NOT FOUND', 'That user is not in this server.')], ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({ embeds: [errorEmbed('CANNOT HOLD', 'That member outranks me.')], ephemeral: true });
    }

    await member.timeout(ms, reason);

    const embed = caseEmbed({
      title: '🕐 HELD FOR QUESTIONING',
      target: `${target.tag} (${target.id})`,
      moderator: interaction.user.tag,
      reason,
      extra: [{ name: 'Duration', value: durationInput, inline: true }]
    });

    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.guild, embed);
  }
};

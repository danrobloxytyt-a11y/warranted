const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { caseEmbed } = require('../../utils/embeds');
const { sendLog } = require('../../utils/log');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a citation to a member, recorded to their file.')
    .addUserOption(o => o.setName('user').setDescription('Who to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the citation').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    db.prepare(
      'INSERT INTO warnings (guild_id, user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(interaction.guild.id, target.id, interaction.user.id, reason, Date.now());

    const count = db.prepare(
      'SELECT COUNT(*) AS c FROM warnings WHERE guild_id = ? AND user_id = ?'
    ).get(interaction.guild.id, target.id).c;

    const embed = caseEmbed({
      title: '📝 CITATION ISSUED',
      target: `${target.tag} (${target.id})`,
      moderator: interaction.user.tag,
      reason,
      extra: [{ name: 'Total citations on file', value: String(count), inline: true }]
    });

    await interaction.reply({ embeds: [embed] });
    await sendLog(interaction.guild, embed);

    target.send({ embeds: [embed] }).catch(() => {});
  }
};

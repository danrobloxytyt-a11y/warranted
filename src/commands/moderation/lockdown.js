const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock or unlock the current channel.')
    .addSubcommand(sc => sc.setName('lock').setDescription('Freeze this channel (block @everyone from sending)'))
    .addSubcommand(sc => sc.setName('unlock').setDescription('Reopen this channel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const everyone = interaction.guild.roles.everyone;

    if (sub === 'lock') {
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: false });
      await interaction.reply({ embeds: [successEmbed('🔒 CHANNEL FROZEN', 'This channel has been locked down.')] });
    } else {
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: null });
      await interaction.reply({ embeds: [successEmbed('🔓 CHANNEL REOPENED', 'This channel is unlocked.')] });
    }
  }
};

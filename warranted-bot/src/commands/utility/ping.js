const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check if the line is still connected.'),
  async execute(interaction) {
    const embed = baseEmbed(config.colors.silver)
      .setTitle('📡 CONNECTION LIVE')
      .setDescription(`Latency: ${interaction.client.ws.ping}ms`);
    await interaction.reply({ embeds: [embed] });
  }
};

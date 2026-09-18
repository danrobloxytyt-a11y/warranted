const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function baseEmbed(color = config.colors.black) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

function successEmbed(title, description) {
  return baseEmbed(config.colors.silver).setTitle(title).setDescription(description);
}

function errorEmbed(title, description) {
  return baseEmbed(config.colors.red).setTitle(title).setDescription(description);
}

function caseEmbed({ title, target, moderator, reason, extra }) {
  const embed = baseEmbed(config.colors.red)
    .setTitle(title)
    .addFields(
      { name: 'Subject', value: `${target}`, inline: true },
      { name: 'Handler', value: `${moderator}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided.' }
    );
  if (extra) embed.addFields(extra);
  return embed;
}

module.exports = { baseEmbed, successEmbed, errorEmbed, caseEmbed };

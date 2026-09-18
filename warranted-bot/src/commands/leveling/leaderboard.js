const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../../utils/embeds');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See who\'s most wanted (top XP in the server).'),

  async execute(interaction) {
    const rows = db.prepare(
      'SELECT user_id, xp FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10'
    ).all(interaction.guild.id);

    if (rows.length === 0) {
      return interaction.reply({ embeds: [baseEmbed(config.colors.black).setTitle('🔥 MOST WANTED').setDescription('No activity logged yet.')] });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const description = rows.map((r, i) => {
      const level = config.levelFromXp(r.xp);
      const prefix = medals[i] || `**${i + 1}.**`;
      return `${prefix} <@${r.user_id}> — Level ${level} (${r.xp} XP)`;
    }).join('\n');

    const embed = baseEmbed(config.colors.silver).setTitle('🔥 MOST WANTED').setDescription(description);
    await interaction.reply({ embeds: [embed] });
  }
};

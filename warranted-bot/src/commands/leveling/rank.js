const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../database');
const { generateRankCard } = require('../../utils/rankcard');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your standing (or someone else\'s).')
    .addUserOption(o => o.setName('user').setDescription('Whose rank to check')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;

    const row = db.prepare('SELECT xp FROM levels WHERE guild_id = ? AND user_id = ?')
      .get(interaction.guild.id, target.id);

    const xp = row ? row.xp : 0;
    const level = config.levelFromXp(xp);
    const nextLevelXp = config.xpForLevel(level + 1);
    const currentLevelXp = config.xpForLevel(level);

    const rankRow = db.prepare(`
      SELECT COUNT(*) + 1 AS rank FROM levels
      WHERE guild_id = ? AND xp > (SELECT COALESCE(xp, 0) FROM levels WHERE guild_id = ? AND user_id = ?)
    `).get(interaction.guild.id, interaction.guild.id, target.id);

    await interaction.deferReply();

    try {
      const buffer = await generateRankCard({
        username: target.username,
        avatarURL: target.displayAvatarURL({ extension: 'png', size: 256 }),
        level,
        rank: rankRow.rank,
        xp,
        currentLevelXp,
        nextLevelXp
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'rank.png' });
      await interaction.editReply({ files: [attachment] });
    } catch (err) {
      console.error('Failed to generate rank card:', err);
      await interaction.editReply({
        embeds: [errorEmbed('CARD FAILED', 'Could not generate the rank card. Check the console log.')]
      });
    }
  }
};

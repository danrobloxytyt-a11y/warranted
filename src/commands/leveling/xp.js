const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed } = require('../../utils/embeds');
const config = require('../../config');
const db = require('../../database');
const { applyLevelRewards } = require('../../utils/leveling');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manually adjust a member\'s XP.')
    .addSubcommand(sc => sc
      .setName('add')
      .setDescription('Add XP')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('remove')
      .setDescription('Remove XP')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('set')
      .setDescription('Set XP to an exact value')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const row = db.prepare('SELECT xp FROM levels WHERE guild_id = ? AND user_id = ?')
      .get(interaction.guild.id, target.id);
    let xp = row ? row.xp : 0;

    if (sub === 'add') xp += amount;
    else if (sub === 'remove') xp = Math.max(0, xp - amount);
    else xp = Math.max(0, amount);

    db.prepare(`
      INSERT INTO levels (guild_id, user_id, xp) VALUES (?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = excluded.xp
    `).run(interaction.guild.id, target.id, xp);

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) await applyLevelRewards(member, xp);

    await interaction.reply({
      embeds: [successEmbed('XP UPDATED', `${target.tag} now has **${xp} XP** (Level ${config.levelFromXp(xp)}).`)]
    });
  }
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, baseEmbed } = require('../../utils/embeds');
const config = require('../../config');
const db = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelrewards')
    .setDescription('Manage automatic role rewards for reaching a level.')
    .addSubcommand(sc => sc
      .setName('add')
      .setDescription('Bind a role to a level')
      .addIntegerOption(o => o.setName('level').setDescription('Level required').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to grant').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('remove')
      .setDescription('Unbind a level reward')
      .addIntegerOption(o => o.setName('level').setDescription('Level to clear').setRequired(true)))
    .addSubcommand(sc => sc.setName('list').setDescription('Show all level rewards'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      db.prepare(`
        INSERT INTO level_rewards (guild_id, level, role_id) VALUES (?, ?, ?)
        ON CONFLICT(guild_id, level) DO UPDATE SET role_id = excluded.role_id
      `).run(interaction.guild.id, level, role.id);

      return interaction.reply({
        embeds: [successEmbed('🎖️ REWARD BOUND', `Reaching **Level ${level}** now grants ${role}.`)]
      });
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level');
      db.prepare('DELETE FROM level_rewards WHERE guild_id = ? AND level = ?').run(interaction.guild.id, level);
      return interaction.reply({ embeds: [successEmbed('REWARD REMOVED', `Level ${level} no longer grants a role.`)] });
    }

    // list
    const rows = db.prepare('SELECT level, role_id FROM level_rewards WHERE guild_id = ? ORDER BY level ASC')
      .all(interaction.guild.id);

    const embed = baseEmbed(config.colors.black).setTitle('🎖️ LEVEL REWARDS');
    embed.setDescription(rows.length
      ? rows.map(r => `Level ${r.level} → <@&${r.role_id}>`).join('\n')
      : 'No level rewards configured yet.');

    await interaction.reply({ embeds: [embed] });
  }
};

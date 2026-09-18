const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, baseEmbed } = require('../../utils/embeds');
const { DEFAULT_THRESHOLD } = require('../../utils/evidence');
const config = require('../../config');
const db = require('../../database');

function upsertConfig(guildId, fields) {
  const existing = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!existing) {
    db.prepare('INSERT INTO guild_config (guild_id) VALUES (?)').run(guildId);
  }
  const setClause = Object.keys(fields).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE guild_config SET ${setClause} WHERE guild_id = @guild_id`)
    .run({ ...fields, guild_id: guildId });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evidence')
    .setDescription('Configure the Evidence Locker (reaction-triggered highlight board).')
    .addSubcommand(sc => sc
      .setName('setup')
      .setDescription('Set the board channel, trigger emoji, and threshold')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post evidence in').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji that triggers a post, e.g. 🔍').setRequired(true))
      .addIntegerOption(o => o.setName('threshold').setDescription(`Reactions needed (default ${DEFAULT_THRESHOLD})`)))
    .addSubcommand(sc => sc.setName('status').setDescription('Show the current Evidence Locker configuration'))
    .addSubcommand(sc => sc.setName('disable').setDescription('Turn off the Evidence Locker'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      const emoji = interaction.options.getString('emoji');
      const threshold = interaction.options.getInteger('threshold') || DEFAULT_THRESHOLD;

      upsertConfig(guildId, {
        evidence_channel: channel.id,
        evidence_emoji: emoji,
        evidence_threshold: threshold
      });

      return interaction.reply({
        embeds: [successEmbed(
          'EVIDENCE LOCKER ACTIVE',
          `Messages reaching **${threshold}x ${emoji}** now get pinned to ${channel}.`
        )],
        ephemeral: true
      });
    }

    if (sub === 'status') {
      const cfg = db.prepare('SELECT evidence_channel, evidence_emoji, evidence_threshold FROM guild_config WHERE guild_id = ?')
        .get(guildId);

      const embed = baseEmbed(config.colors.black).setTitle('EVIDENCE LOCKER STATUS');
      if (!cfg?.evidence_channel) {
        embed.setDescription('Not configured. Run `/evidence setup` to turn it on.');
      } else {
        embed.setDescription(
          `Channel: <#${cfg.evidence_channel}>\nTrigger: ${cfg.evidence_emoji}\nThreshold: ${cfg.evidence_threshold || DEFAULT_THRESHOLD}`
        );
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'disable') {
      upsertConfig(guildId, { evidence_channel: null, evidence_emoji: null, evidence_threshold: null });
      return interaction.reply({ embeds: [successEmbed('EVIDENCE LOCKER DISABLED', 'No new messages will be pinned.')], ephemeral: true });
    }
  }
};

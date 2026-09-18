const { baseEmbed } = require('../utils/embeds');
const config = require('../config');
const db = require('../database');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(member.guild.id);
    if (!row) return;

    if (row.autorole) {
      await member.roles.add(row.autorole).catch(() => {});
    }

    if (row.welcome_channel && row.welcome_message) {
      const channel = member.guild.channels.cache.get(row.welcome_channel);
      if (channel) {
        const text = row.welcome_message
          .replaceAll('{user}', `${member}`)
          .replaceAll('{server}', member.guild.name);
        const embed = baseEmbed(config.colors.silver)
          .setTitle('📸 NEW BOOKING')
          .setDescription(text)
          .setThumbnail(member.user.displayAvatarURL());
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  }
};

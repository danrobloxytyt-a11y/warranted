const { baseEmbed } = require('../utils/embeds');
const config = require('../config');
const db = require('../database');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(member.guild.id);
    if (!row || !row.goodbye_channel || !row.goodbye_message) return;

    const channel = member.guild.channels.cache.get(row.goodbye_channel);
    if (!channel) return;

    const text = row.goodbye_message
      .replaceAll('{user}', member.user.username)
      .replaceAll('{server}', member.guild.name);

    const embed = baseEmbed(config.colors.red).setTitle('📤 CASE FILE ARCHIVED').setDescription(text);
    channel.send({ embeds: [embed] }).catch(() => {});
  }
};

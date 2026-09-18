const { grantMessageXp } = require('../utils/leveling');
const db = require('../database');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    await grantMessageXp(message);

    if (message.author.bot || !message.guild) return;

    const triggers = db.prepare('SELECT * FROM informant_triggers WHERE guild_id = ?').all(message.guild.id);
    const content = message.content.toLowerCase();

    const match = triggers.find(t => content.includes(t.trigger.toLowerCase()));
    if (match) {
      await message.reply({ content: match.response }).catch(() => {});
    }
  }
};

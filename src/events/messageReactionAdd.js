const db = require('../database');
const { handleReactionChange } = require('../utils/evidence');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => null);

    const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

    const row = db.prepare('SELECT role_id FROM reaction_roles WHERE message_id = ? AND emoji = ?')
      .get(reaction.message.id, emojiKey);

    if (row) {
      const guild = reaction.message.guild;
      if (guild) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) {
          await member.roles.add(row.role_id).catch(err => console.error('Failed to add clearance role:', err.message));
        }
      }
    }

    await handleReactionChange(reaction, user).catch(err => console.error('Evidence board error:', err.message));
  }
};

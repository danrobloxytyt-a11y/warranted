const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[WARRANTED] Logged in as ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: 'the block', type: ActivityType.Watching }],
      status: 'online'
    });
  }
};

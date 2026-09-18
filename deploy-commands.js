require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];

function collectCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCommands(full);
    } else if (entry.name.endsWith('.js')) {
      const command = require(full);
      if (command?.data) commands.push(command.data.toJSON());
    }
  }
}
collectCommands(path.join(__dirname, 'src', 'commands'));

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Deployed successfully. Commands are live in your server.');
  } catch (err) {
    console.error('Deployment failed:', err);
  }
})();

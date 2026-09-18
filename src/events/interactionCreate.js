const { errorEmbed, successEmbed } = require('../utils/embeds');
const { openTicket, closeTicket } = require('../utils/tickets');
const db = require('../database');

async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const embed = errorEmbed('SOMETHING WENT WRONG', 'That command hit a snag. Check the console log.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
}

async function handleButton(interaction) {
  const id = interaction.customId;

  try {
    if (id.startsWith('ticket_open::')) {
      const optionId = id.split('::')[1];
      const optionRow = db.prepare('SELECT * FROM ticket_options WHERE id = ?').get(optionId);
      if (!optionRow) {
        return interaction.reply({ embeds: [errorEmbed('OPTION NOT FOUND', 'This case type no longer exists.')], ephemeral: true });
      }
      await openTicket(interaction, optionRow);
      return;
    }

    if (id === 'ticket_close') {
      await interaction.reply({ embeds: [successEmbed('CLOSING CASE', 'Generating transcript and archiving...')] });
      await closeTicket(interaction.channel, interaction.user);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }
  } catch (err) {
    console.error(`Error handling button ${id}:`, err);
    const embed = errorEmbed('SOMETHING WENT WRONG', 'That action hit a snag. Check the console log.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    }
  }
};

const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../../utils/embeds');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Show everything this bot can do.'),

  async execute(interaction) {
    const embed = baseEmbed(config.colors.silver).setTitle('THE LEDGER — COMMAND INDEX').addFields(
      {
        name: 'Enforcement',
        value: '`/ban` `/unban` `/kick` `/timeout` `/warn` `/warnings` `/purge` `/lockdown lock|unlock`'
      },
      {
        name: 'Rank Progression',
        value: '`/rank` `/leaderboard` `/levelrewards add|remove|list` `/xp add|remove|set`'
      },
      {
        name: 'Clearance',
        value: '`/clearance add|remove|list`'
      },
      {
        name: 'Case Files',
        value: '`/casefile panelcreate|optionadd|optionremove|staffrole|category|blacklistadd|blacklistremove`\n`/case add|remove|close|transcript`'
      },
      {
        name: 'VoiceMaster',
        value: '`/voicemaster setup|lock|unlock|limit|rename|claim|kick|invite`'
      },
      {
        name: 'Evidence Locker',
        value: '`/evidence setup|status|disable`'
      },
      {
        name: 'Informants',
        value: '`/informant triggeradd|triggerremove|triggerlist|timeradd|timerremove|timerlist`'
      },
      {
        name: 'Intake',
        value: '`/intake welcome` `/intake goodbye` `/intake autorole` `/intake logchannel`'
      },
      {
        name: 'Utility',
        value: '`/verdict` `/ping` `/help`'
      }
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

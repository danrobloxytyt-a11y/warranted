const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Clean up recent messages in this channel.')
    .addIntegerOption(o => o.setName('amount').setDescription('How many messages (1-100)').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');

    if (amount < 1 || amount > 100) {
      return interaction.reply({ embeds: [errorEmbed('INVALID AMOUNT', 'Pick a number between 1 and 100.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const filtered = user ? messages.filter(m => m.author.id === user.id).first(amount) : messages.first(amount);

    const deleted = await interaction.channel.bulkDelete(filtered, true).catch(() => null);

    await interaction.editReply({
      embeds: [successEmbed('🧹 CLEANED UP', `Removed ${deleted ? deleted.size : 0} message(s).`)]
    });
  }
};

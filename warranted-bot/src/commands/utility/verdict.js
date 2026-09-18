const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../../utils/embeds');
const config = require('../../config');

const NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verdict')
    .setDescription('Put something to a vote.')
    .addStringOption(o => o.setName('question').setDescription('The question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Comma-separated options (2-10). Leave blank for yes/no.')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const optionsRaw = interaction.options.getString('options');

    const embed = baseEmbed(config.colors.black).setTitle('⚖️ VERDICT CALLED').setDescription(`**${question}**`);

    if (!optionsRaw) {
      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      await reply.react('👍');
      await reply.react('👎');
      return;
    }

    const options = optionsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    if (options.length < 2) {
      return interaction.reply({ content: 'Provide at least 2 options, comma-separated.', ephemeral: true });
    }

    embed.addFields({
      name: 'Options',
      value: options.map((opt, i) => `${NUMBER_EMOJI[i]} ${opt}`).join('\n')
    });

    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await reply.react(NUMBER_EMOJI[i]);
    }
  }
};

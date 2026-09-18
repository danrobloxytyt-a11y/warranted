const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { closeTicket, generateTranscript } = require('../../utils/tickets');
const db = require('../../database');

function getOpenTicket(channelId) {
  return db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(channelId);
}

// Staff = has Manage Channels natively, OR holds the configured ticket staff
// role. Kept separate from "is the person who opened this case" so add/remove
// can be locked to staff-only while close/transcript stay usable by the
// opener too.
function isStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;

  const cfg = db.prepare('SELECT ticket_staff_role FROM guild_config WHERE guild_id = ?').get(member.guild.id);
  if (cfg?.ticket_staff_role && member.roles.cache.has(cfg.ticket_staff_role)) return true;

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Manage the case file in this channel.')
    .addSubcommand(sc => sc
      .setName('add')
      .setDescription('(Staff) Add a user to this case file')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('remove')
      .setDescription('(Staff) Remove a user from this case file')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(sc => sc.setName('close').setDescription('Close this case file'))
    .addSubcommand(sc => sc.setName('transcript').setDescription('Get a transcript without closing')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const ticket = getOpenTicket(interaction.channel.id);

    if (!ticket) {
      return interaction.reply({
        embeds: [errorEmbed('NOT A CASE FILE', 'This command only works inside an open case file channel.')],
        ephemeral: true
      });
    }

    const staff = isStaff(interaction.member);
    const isOpener = interaction.user.id === ticket.opener_id;

    // add/remove touch other people's access to this channel — staff only,
    // regardless of who opened the case.
    if (sub === 'add' || sub === 'remove') {
      if (!staff) {
        return interaction.reply({
          embeds: [errorEmbed('ACCESS DENIED', 'Only staff can add or remove members from a case file.')],
          ephemeral: true
        });
      }
    }

    // close/transcript are fine for either staff or the person who opened it.
    if (sub === 'close' || sub === 'transcript') {
      if (!staff && !isOpener) {
        return interaction.reply({
          embeds: [errorEmbed('ACCESS DENIED', 'Only staff or the person who opened this case can do that.')],
          ephemeral: true
        });
      }
    }

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      return interaction.reply({ embeds: [successEmbed('ADDED', `${user} added to this case file.`)] });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
      return interaction.reply({ embeds: [successEmbed('REMOVED', `${user} removed from this case file.`)] });
    }

    if (sub === 'transcript') {
      await interaction.deferReply({ ephemeral: true });
      const file = await generateTranscript(interaction.channel);
      return interaction.editReply({ files: [file] });
    }

    if (sub === 'close') {
      await interaction.reply({ embeds: [successEmbed('CLOSING CASE', 'Generating transcript and archiving...')] });
      await closeTicket(interaction.channel, interaction.user);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  }
};

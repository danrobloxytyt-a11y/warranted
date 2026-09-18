const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder
} = require('discord.js');
const db = require('../database');
const { baseEmbed, successEmbed, errorEmbed } = require('./embeds');
const config = require('../config');

// True if the interacting member is allowed to manage a specific ticket's
// membership (add/remove other people from it). Deliberately narrower than
// "close" — anyone with legitimate access to the channel can close their own
// case, but only the actual owner or staff should be able to add/remove
// OTHER people from a private ticket.
function isTicketManager(member, ticket) {
  if (member.id === ticket.opener_id) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

  const cfg = db.prepare('SELECT ticket_staff_role FROM guild_config WHERE guild_id = ?').get(ticket.guild_id);
  if (cfg?.ticket_staff_role && member.roles.cache.has(cfg.ticket_staff_role)) return true;

  return false;
}

function buildPanelRow(panelMessageId) {
  const options = db.prepare('SELECT * FROM ticket_options WHERE panel_message_id = ?').all(panelMessageId);
  if (options.length === 0) return null;

  const row = new ActionRowBuilder();
  for (const opt of options.slice(0, 5)) { // Discord caps 5 buttons per row
    const button = new ButtonBuilder()
      .setCustomId(`ticket_open::${opt.id}`)
      .setLabel(opt.label)
      .setStyle(ButtonStyle.Secondary);
    if (opt.emoji) button.setEmoji(opt.emoji);
    row.addComponents(button);
  }
  return row;
}

async function refreshPanelMessage(client, panelMessageId) {
  const panel = db.prepare('SELECT * FROM ticket_panels WHERE message_id = ?').get(panelMessageId);
  if (!panel) return;

  const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(panelMessageId).catch(() => null);
  if (!message) return;

  const row = buildPanelRow(panelMessageId);
  await message.edit({ components: row ? [row] : [] }).catch(() => {});
}

async function openTicket(interaction, optionRow) {
  const guild = interaction.guild;
  const user = interaction.user;

  const blacklisted = db.prepare('SELECT 1 FROM ticket_blacklist WHERE guild_id = ? AND user_id = ?')
    .get(guild.id, user.id);
  if (blacklisted) {
    return interaction.reply({
      embeds: [errorEmbed('ACCESS DENIED', 'You are not permitted to open a case file.')],
      ephemeral: true
    });
  }

  const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND opener_id = ? AND status = 'open'")
    .get(guild.id, user.id);
  if (existing) {
    return interaction.reply({
      embeds: [errorEmbed('CASE ALREADY OPEN', `You already have an open case file: <#${existing.channel_id}>`)],
      ephemeral: true
    });
  }

  const cfg = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guild.id);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: interaction.client.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
    }
  ];
  if (cfg?.ticket_staff_role) {
    overwrites.push({
      id: cfg.ticket_staff_role,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const safeName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'member';

  const channel = await guild.channels.create({
    name: `case-${safeName}`,
    type: ChannelType.GuildText,
    parent: cfg?.ticket_category || null,
    permissionOverwrites: overwrites
  });

  db.prepare(`
    INSERT INTO tickets (guild_id, channel_id, opener_id, option_label, status, opened_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `).run(guild.id, channel.id, user.id, optionRow.label, Date.now());

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Case').setStyle(ButtonStyle.Danger)
  );

  const openEmbed = baseEmbed(config.colors.black)
    .setTitle('CASE FILE OPENED')
    .setDescription(`Subject: ${user}\nType: **${optionRow.label}**\n\nState your business. Staff will respond shortly.`);

  await channel.send({ content: `${user}`, embeds: [openEmbed], components: [closeRow] });

  await interaction.reply({
    embeds: [successEmbed('CASE FILE CREATED', `Your case has been opened: ${channel}`)],
    ephemeral: true
  });
}

// Fetches up to 1000 messages from a ticket channel, oldest first.
async function fetchAllMessages(channel) {
  let messages = [];
  let lastId;

  for (let i = 0; i < 10; i++) { // up to 1000 messages
    const batch = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
    if (!batch || batch.size === 0) break;
    messages = messages.concat(Array.from(batch.values()));
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }

  messages.reverse();
  return messages;
}

// Builds a readable transcript as Discord embeds — this is what actually
// gets read. Chunked to stay well under Discord's per-embed (4096 char) and
// per-message (6000 char total, 10 embeds max) limits, splitting into
// multiple messages if a ticket ran unusually long.
function buildTranscriptEmbeds(messages, channelName) {
  if (messages.length === 0) {
    return [[baseEmbed(config.colors.black).setTitle('TRANSCRIPT').setDescription('No messages were sent in this case.')]];
  }

  const lines = messages.map(m => {
    const time = `<t:${Math.floor(m.createdTimestamp / 1000)}:t>`;
    const content = m.content?.trim()
      || (m.attachments.size > 0 ? `*[${m.attachments.size} attachment(s)]*` : '*[no text content]*');
    return `**${m.author.tag}** • ${time}\n${content}`;
  });

  // Pack lines into ~1800-char embed chunks, then batch up to 10 embeds per message.
  const embedChunks = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? `${current}\n\n${line}` : line;
    if (candidate.length > 1800) {
      embedChunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) embedChunks.push(current);

  const embeds = embedChunks.map((desc, i) =>
    baseEmbed(config.colors.black)
      .setTitle(i === 0 ? `TRANSCRIPT — ${channelName}` : `TRANSCRIPT (cont.)`)
      .setDescription(desc)
  );

  // Group into batches of 10 embeds — that's the max Discord allows per message.
  const messageBatches = [];
  for (let i = 0; i < embeds.length; i += 10) {
    messageBatches.push(embeds.slice(i, i + 10));
  }
  return messageBatches;
}

// Full plain-text backup, still attached alongside the embeds — useful for
// searching or archiving outside Discord, even though the embeds are what
// staff will actually read.
function buildTranscriptFile(messages, channelName) {
  const lines = messages.map(m => {
    const time = new Date(m.createdTimestamp).toISOString();
    return `[${time}] ${m.author.tag}: ${m.content}`;
  });
  const buffer = Buffer.from(lines.join('\n') || 'No messages.', 'utf-8');
  return new AttachmentBuilder(buffer, { name: `${channelName}-transcript.txt` });
}

// Kept for /case transcript (grab a copy without closing) — returns just the
// raw file, same as before, for anything that only wants the plain backup.
async function generateTranscript(channel) {
  const messages = await fetchAllMessages(channel);
  return buildTranscriptFile(messages, channel.name);
}

// Full readable transcript build: fetches once, returns everything needed to
// post both the readable embeds and the raw file backup.
async function buildFullTranscript(channel) {
  const messages = await fetchAllMessages(channel);
  return {
    embedBatches: buildTranscriptEmbeds(messages, channel.name),
    file: buildTranscriptFile(messages, channel.name)
  };
}

async function closeTicket(channel, closedByUser) {
  const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(channel.id);
  if (!ticket) return null;

  const { embedBatches, file } = await buildFullTranscript(channel);

  const cfg = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(channel.guild.id);
  const destinationId = cfg?.ticket_transcript_channel || cfg?.log_channel;

  if (destinationId) {
    const destChannel = channel.guild.channels.cache.get(destinationId);
    if (destChannel) {
      const summaryEmbed = baseEmbed(config.colors.black)
        .setTitle('CASE FILE CLOSED')
        .addFields(
          { name: 'Subject', value: `<@${ticket.opener_id}>`, inline: true },
          { name: 'Closed by', value: `${closedByUser}`, inline: true },
          { name: 'Type', value: ticket.option_label || 'N/A', inline: true }
        );
      await destChannel.send({ embeds: [summaryEmbed] }).catch(() => {});

      for (let i = 0; i < embedBatches.length; i++) {
        const isLast = i === embedBatches.length - 1;
        await destChannel.send({
          embeds: embedBatches[i],
          files: isLast ? [file] : []
        }).catch(() => {});
      }
    }
  }

  db.prepare("UPDATE tickets SET status = 'closed', closed_at = ?, closed_by = ? WHERE channel_id = ?")
    .run(Date.now(), closedByUser.id, channel.id);

  return ticket;
}

module.exports = {
  buildPanelRow,
  refreshPanelMessage,
  openTicket,
  closeTicket,
  generateTranscript,
  buildFullTranscript
};

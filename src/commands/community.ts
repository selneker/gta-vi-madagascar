import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from 'discord.js'
import {
  getProfile,
  createEvent,
  listEvents,
  registerEvent,
  createTicket,
  closeTicket,
  submitSuggestion,
} from '../services/community-center.js'
import { logger } from '../lib/logger.js'
import { resolveChannel } from '../lib/resolve.js'

export const data = new SlashCommandBuilder()
  .setName('community')
  .setDescription('Community — profils, événements, tickets, suggestions')
  .addSubcommand((sub) =>
    sub.setName('profile').setDescription('Voir votre profil / View your profile').addUserOption((opt) =>
      opt.setName('utilisateur').setDescription('Utilisateur / User').setRequired(false)
    )
  )
  .addSubcommand((sub) =>
    sub
      .setName('event')
      .setDescription('Événements communautaires / Community events')
      .addStringOption((opt) =>
        opt.setName('action').setDescription('Action / Action').setRequired(true).addChoices(
          { name: 'Créer / Create', value: 'create' },
          { name: 'S\'inscrire / Register', value: 'register' },
          { name: 'Lister / List', value: 'list' }
        )
      )
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID de l\'événement / Event ID').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('titre').setDescription('Titre / Title').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('type').setDescription('Type / Type').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('start').setDescription('Date de début / Start date (ISO)').setRequired(false)
      )
      .addStringOption((opt) =>
        opt.setName('end').setDescription('Date de fin / End date (ISO)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('ticket')
      .setDescription('Tickets de support / Support tickets')
      .addStringOption((opt) =>
        opt.setName('action').setDescription('Action / Action').setRequired(true).addChoices(
          { name: 'Ouvrir / Open', value: 'open' },
          { name: 'Fermer / Close', value: 'close' }
        )
      )
      .addStringOption((opt) =>
        opt.setName('type').setDescription('Type / Type').setRequired(false).addChoices(
          { name: 'Support', value: 'SUPPORT' },
          { name: 'Signalement / Report', value: 'REPORT' },
          { name: 'Partenariat / Partnership', value: 'PARTNERSHIP' },
          { name: 'Technique / Technical', value: 'TECHNICAL' }
        )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('suggest')
      .setDescription('Proposer une suggestion / Submit a suggestion')
      .addStringOption((opt) =>
        opt.setName('titre').setDescription('Titre / Title').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('description').setDescription('Description / Description').setRequired(true)
      )
  )

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild || !interaction.member) {
    await interaction.reply({
      content: 'Cette commande ne fonctionne que dans un serveur / This command only works inside a server.',
      ephemeral: true,
    })
    return
  }

  const guild = interaction.guild
  const member = interaction.member as GuildMember
  const subcommand = interaction.options.getSubcommand(true)

  try {
    switch (subcommand) {
      case 'profile':
        await handleProfile(interaction, guild)
        break
      case 'event':
        await handleEvent(interaction, guild, member)
        break
      case 'ticket':
        await handleTicket(interaction, guild, member)
        break
      case 'suggest':
        await handleSuggest(interaction, guild)
        break
      default:
        await interaction.reply({ content: 'Sous-commande inconnue / Unknown subcommand.', ephemeral: true })
    }
  } catch (error) {
    deps.logger.error({ subcommand, error: String(error) }, '/community command failed')
    const content = 'Une erreur est survenue / An error occurred while running /community.'
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true })
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community profile
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleProfile(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const targetUser = interaction.options.getUser('utilisateur') ?? interaction.user
  const profile = await getProfile(targetUser.id, guild.id)

  const embed = new EmbedBuilder()
    .setTitle(`👤 Profil / Profile — ${targetUser.username}`)
    .setColor(0x00ffff)
    .setThumbnail(targetUser.displayAvatarURL())
    .setTimestamp()
    .addFields(
      { name: 'Utilisateur / User', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Niveau / Level', value: String(profile?.level ?? 1), inline: true },
      { name: 'XP', value: String(profile?.xp ?? 0), inline: true }
    )

  if (profile?.xpTransactions?.length) {
    const recent = profile.xpTransactions
      .map((t: any) => `+${t.amount} — ${t.reason} (<t:${Math.floor(t.createdAt.getTime() / 1000)}:R>)`)
      .join('\n')
    embed.addFields({ name: 'XP récent / Recent XP', value: recent, inline: false })
  }

  await interaction.editReply({ embeds: [embed] })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community event
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleEvent(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  const action = interaction.options.getString('action', true)

  if (action === 'list') {
    await interaction.deferReply({ ephemeral: true })
    const events = await listEvents(guild.id)
    const embed = new EmbedBuilder()
      .setTitle('🎪 Événements à venir / Upcoming Events')
      .setColor(0xffd700)
      .setTimestamp()
    if (events.length === 0) {
      embed.setDescription('Aucun événement programmé / No events scheduled.')
    } else {
      for (const e of events) {
        embed.addFields({
          name: `${e.title} (${e.id.slice(-6)})`,
          value: `Type: ${e.type}\nDébut: <t:${Math.floor(e.scheduledStart.getTime() / 1000)}:F>\nLieu: ${e.location ?? 'Non défini'}`,
          inline: true,
        })
      }
    }
    await interaction.editReply({ embeds: [embed] })
    return
  }

  if (action === 'create') {
    await interaction.deferReply({ ephemeral: true })
    const title = interaction.options.getString('titre', true)
    const typeRaw = interaction.options.getString('type') || 'COMMUNITY_NIGHT'
    const startRaw = interaction.options.getString('start')
    const endRaw = interaction.options.getString('end')
    if (!startRaw || !endRaw) {
      await interaction.editReply({ content: 'Fournissez les dates de début et de fin / Provide start and end dates.' })
      return
    }
    const event = await createEvent(guild.id, member.id, {
      title,
      type: typeRaw,
      scheduledStart: new Date(startRaw),
      scheduledEnd: new Date(endRaw),
    })
    await interaction.editReply({
      content: `Événement créé / Event created: **${event.title}** (ID: ${event.id})`,
    })
    return
  }

  if (action === 'register') {
    await interaction.deferReply({ ephemeral: true })
    const eventId = interaction.options.getString('id', true)
    try {
      await registerEvent(eventId, member.id)
      await interaction.editReply({ content: `Inscrit à l'événement / Registered for event: ${eventId}` })
    } catch (error) {
      await interaction.editReply({ content: `Échec de l'inscription / Registration failed: ${String(error)}` })
    }
    return
  }

  await interaction.reply({ content: 'Action inconnue / Unknown action.', ephemeral: true })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community ticket
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleTicket(
  interaction: ChatInputCommandInteraction,
  guild: any,
  member: GuildMember
): Promise<void> {
  const action = interaction.options.getString('action', true)

  if (action === 'open') {
    await interaction.deferReply({ ephemeral: true })
    const typeRaw = interaction.options.getString('type') || 'SUPPORT'
    const ticketChannel = resolveChannel(guild, 'ch_create_ticket')
    if (!ticketChannel) {
      await interaction.editReply({ content: 'Salon de tickets introuvable / Ticket channel not found.' })
      return
    }
    const ticket = await createTicket(guild.id, member.id, ticketChannel.id, typeRaw)
    await interaction.editReply({
      content: `Ticket ouvert / Ticket opened: <#${ticketChannel.id}> (ID: ${ticket.id})`,
    })
    return
  }

  if (action === 'close') {
    await interaction.deferReply({ ephemeral: true })
    try {
      await closeTicket(interaction.channelId, member.id)
      await interaction.editReply({ content: 'Ticket fermé / Ticket closed.' })
    } catch (error) {
      await interaction.editReply({ content: `Échec de la fermeture / Close failed: ${String(error)}` })
    }
    return
  }

  await interaction.reply({ content: 'Action inconnue / Unknown action.', ephemeral: true })
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /community suggest
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

async function handleSuggest(interaction: ChatInputCommandInteraction, guild: any): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const title = interaction.options.getString('titre', true)
  const description = interaction.options.getString('description', true)

  await submitSuggestion(guild.id, interaction.user.id, title, description)

  const suggestChannel = resolveChannel(guild, 'ch_suggestions')
  if (suggestChannel && suggestChannel.isTextBased?.()) {
    await (suggestChannel as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setTitle('💡 Nouvelle suggestion / New Suggestion')
          .setColor(0x00ff00)
          .addFields(
            { name: 'Titre / Title', value: title, inline: false },
            { name: 'Description', value: description, inline: false },
            { name: 'Par / By', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp(),
      ],
    })
  }

  await interaction.editReply({ content: 'Suggestion soumise / Suggestion submitted.' })
}

import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Role,
  GuildMember,
} from 'discord.js'
import { logger } from '../lib/logger.js'
import { resolveRole } from '../lib/resolve.js'
import { updateProfile } from '../services/community-center.js'

/** Custom ID du bouton qui ouvre le modal de sondage d'accueil. */
export const welcomeSurveyButtonCustomId = 'welcome:survey'

/** Custom ID du sélecteur de rôles dans le message d'accueil. */
export const roleSelectCustomId = 'welcome:roles'

/** Custom ID du modal de sondage d'accueil. */
export const welcomeSurveyModalCustomId = 'welcome:survey:modal'

/** Rôles auto-assignables proposés aux nouveaux membres (ids = clés de config, résolues par nom). */
const AUTO_ROLES: { id: string; name: string; label: string; emoji?: string }[] = [
  { id: 'role_lang_mg', name: 'Malagasy', label: 'Malagasy (🇲🇬)', emoji: '🇲🇬' },
  { id: 'role_lang_fr', name: 'French', label: 'French (🇫🇷)', emoji: '🇫🇷' },
  { id: 'role_lang_en', name: 'English', label: 'English (🇬🇧)', emoji: '🇬🇧' },
  { id: 'role_playstation', name: 'PlayStation', label: 'PlayStation', emoji: '🎮' },
  { id: 'role_xbox', name: 'Xbox', label: 'Xbox', emoji: '⏹️' },
  { id: 'role_pc', name: 'PC', label: 'PC', emoji: '🖥️' },
  { id: 'role_streamer', name: 'Streamer', label: 'Streamer (go live)', emoji: '📺' },
  { id: 'role_live_alerts', name: 'Live Alerts', label: 'Alertes Live', emoji: '🔴' },
]

/**
 * Construit le message d'accueil envoyé dans #welcome quand un membre rejoint.
 * Bouton "Sondage d'accueil" + sélecteur de rôles.
 */
export function buildWelcomeEmbed(member: GuildMember): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🏝️ Bienvenue sur GTA VI MADAGASCAR / Welcome')
    .setDescription(
      `Salut <@${member.id}> ! Bienvenue sur le serveur communautaire GTA VI Madagascar.\n\n` +
      'Bienvenue / Welcome / Soavalia — lis les règles, choisis tes rôles et réponds au sondage d\'accueil.\n\n' +
      '🇲🇬 Manao akomba / 🇫🇷 Bienvenue / 🇬🇧 Welcome',
    )
    .setColor(0x00ffff)
    .setTimestamp()
    .addFields(
      {
        name: '📋 Sondage d\'accueil / Welcome Survey',
        value: 'Clique sur le bouton ci-dessous pour répondre au sondage d\'accueil.',
        inline: false,
      },
      {
        name: '🎭 Choisir tes rôles / Choose your roles',
        value: 'Sélectionne tes langues, plateformes et alertes ci-dessous.',
        inline: false,
      },
    )
}

/** Construit les composants du message d'accueil (bouton + sélecteur de rôles). */
export function buildWelcomeComponents(): ActionRowBuilder[] {
  const surveyButton = new ButtonBuilder()
    .setCustomId(welcomeSurveyButtonCustomId)
    .setLabel('Répondre au sondage / Take the survey')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📋')

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(roleSelectCustomId)
    .setPlaceholder('Choisis tes rôles / Choose your roles...')
    .setMinValues(0)
    .setMaxValues(AUTO_ROLES.length)
    .addOptions(
      AUTO_ROLES.map((r) => {
        const option = new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.id)
        if (r.emoji) option.setEmoji(r.emoji)
        return option
      }),
    )

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(surveyButton),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
  ]
}

/**
 * Gère le clic sur le bouton "Sondage d'accueil" : ouvre un modal avec 3 questions.
 */
export async function handleWelcomeSurveyButton(
  interaction: any,
  _deps: { db: unknown; logger: typeof logger },
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(welcomeSurveyModalCustomId)
    .setTitle('Sondage d\'accueil / Welcome Survey')

  const pseudoInput = new TextInputBuilder()
    .setCustomId('welcome:pseudo')
    .setLabel('Ton pseudo / tag GTA VI')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Tony_Leoneida_26')
    .setRequired(true)
    .setMaxLength(50)

  const plateformeInput = new TextInputBuilder()
    .setCustomId('welcome:plateforme')
    .setLabel('Ta plateforme principale')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('PlayStation / Xbox / PC')
    .setRequired(true)
    .setMaxLength(30)

  const langueInput = new TextInputBuilder()
    .setCustomId('welcome:langue')
    .setLabel('Ta langue / Your language')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('malagasy / french / english')
    .setRequired(true)
    .setMaxLength(20)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(pseudoInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(plateformeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(langueInput),
  )

  await interaction.showModal(modal)
}

/**
 * Gère la soumission du modal de sondage d'accueil.
 * Met à jour le profil membre (langue, plateforme) si possible.
 */
export async function handleWelcomeSurveyModal(
  interaction: any,
  deps: { db: unknown; logger: typeof logger },
): Promise<void> {
  const pseudo = interaction.fields.getTextInputValue('welcome:pseudo')
  const plateformeRaw = interaction.fields.getTextInputValue('welcome:plateforme')
  const langueRaw = interaction.fields.getTextInputValue('welcome:langue')

  const userId = interaction.user.id
  const guildId = interaction.guild?.id

  const platformMap: Record<string, { label: string; role: string }> = {
    playstation: { label: 'PlayStation', role: 'role_playstation' },
    ps: { label: 'PlayStation', role: 'role_playstation' },
    ps5: { label: 'PlayStation', role: 'role_playstation' },
    xbox: { label: 'Xbox', role: 'role_xbox' },
    pc: { label: 'PC', role: 'role_pc' },
  }
  const languageMap: Record<string, 'MALAGASY' | 'FRENCH' | 'ENGLISH'> = {
    malagasy: 'MALAGASY',
    mg: 'MALAGASY',
    french: 'FRENCH',
    fr: 'FRENCH',
    english: 'ENGLISH',
    en: 'ENGLISH',
  }
  const platform = platformMap[plateformeRaw.toLowerCase().trim()]
  const language = languageMap[langueRaw.toLowerCase().trim()]

  if (!platform || !language) {
    await interaction.reply({
      content:
        'Plateforme ou langue invalide. Utilise PlayStation, Xbox ou PC, et malagasy, french ou english. / Invalid platform or language.',
      ephemeral: true,
    })
    return
  }

  try {
    if (guildId) {
      await updateProfile(userId, guildId, {
        bio: `Pseudo GTA: ${pseudo} | Plateforme: ${platform.label}`,
        platform: platform.label,
        language,
      })
    }
  } catch (error) {
    deps.logger.error({ userId, guildId, error: String(error) }, 'Welcome survey profile update failed')
  }

  // Grant the platform role right away, so the member does not have to pick it again.
  let platformGranted = false
  try {
    const guild = interaction.guild
    const member = interaction.member
    const role = guild && member ? resolveRole(guild, platform.role) : undefined
    if (role && member && !member.roles.cache.has(role.id)) {
      await member.roles.add(role, 'Welcome survey')
      platformGranted = true
    }
  } catch (error) {
    deps.logger.error({ userId, error: String(error) }, 'Welcome survey platform role failed')
  }

  await interaction.reply({
    content:
      `Merci ${pseudo} ! Profil mis à jour (${platform.label}, ${language}).` +
      (platformGranted ? ` Rôle ${platform.label} ajouté.` : '') +
      '\nN\'oublie pas de choisir tes autres rôles avec le sélecteur ci-dessus.\n\n' +
      'Thank you! Your profile is updated. Pick your other roles with the selector above.',
    ephemeral: true,
  })
}

/**
 * Gère le sélecteur de rôles : ajoute/retire les rôles sélectionnés sur le membre.
 */
export async function handleRoleSelect(
  interaction: any,
  deps: { db: unknown; logger: typeof logger },
): Promise<void> {
  const member = interaction.member as GuildMember
  const guild = interaction.guild
  const selectedValues = interaction.values as string[]

  if (!guild || !member) {
    await interaction.reply({ content: 'Erreur interne / Internal error.', ephemeral: true })
    return
  }

  await guild.roles.fetch()

  const toAdd: Role[] = []
  const toRemove: Role[] = []

  for (const auto of AUTO_ROLES) {
    const role = resolveRole(guild, auto.id)
    if (!role) continue
    const hasRole = member.roles.cache.has(role.id)
    if (selectedValues.includes(auto.id) && !hasRole) toAdd.push(role)
    if (!selectedValues.includes(auto.id) && hasRole) toRemove.push(role)
  }

  try {
    if (toAdd.length) await member.roles.add(toAdd, 'Welcome survey role selection')
    if (toRemove.length) await member.roles.remove(toRemove, 'Welcome survey role deselection')
  } catch (error) {
    deps.logger.error({ userId: member.id, error: String(error) }, 'Role select failed')
    await interaction.reply({
      content: 'Impossible de mettre à jour tes rôles / Failed to update your roles.',
      ephemeral: true,
    })
    return
  }

  const addedNames = toAdd.map((r) => r.name).join(', ') || '—'
  const removedNames = toRemove.map((r) => r.name).join(', ') || '—'

  await interaction.reply({
    content:
      'Rôles mis à jour / Roles updated:\n' +
      `Ajoutés / Added: ${addedNames}\n` +
      `Retirés / Removed: ${removedNames}`,
    ephemeral: true,
  })
}

/**
 * Construit le message de bienvenue final envoyé dans #welcome quand le membre a terminé le sondage.
 */
export function buildPostSurveyEmbed(member: GuildMember): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('✅ Nouveau membre / New member')
    .setDescription(
      `<@${member.id}> a rejoint la communauté GTA VI MADAGASCAR !\n` +
      'Bienvenue / Welcome / Manao akomba !',
    )
    .setColor(0x00ff00)
    .setTimestamp()
    .addFields(
      {
        name: 'Utilisateur / User',
        value: `<@${member.id}>`,
        inline: true,
      },
      {
        name: 'Compte créé / Account created',
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
    )
}

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
import { updateProfile } from '../services/community-center.js'

/** Custom ID du bouton qui ouvre le modal de sondage d'accueil. */
export const welcomeSurveyButtonCustomId = 'welcome:survey'

/** Custom ID du sélecteur de rôles dans le message d'accueil. */
export const roleSelectCustomId = 'welcome:roles'

/** Custom ID du modal de sondage d'accueil. */
export const welcomeSurveyModalCustomId = 'welcome:survey:modal'

/** Rôles auto-assignables proposés aux nouveaux membres. */
const AUTO_ROLES: { id: string; name: string; label: string; emoji?: string }[] = [
  { id: 'role_lang_mg', name: 'Malagasy', label: 'Malagasy (🇲🇬)', emoji: '🇲🇬' },
  { id: 'role_lang_fr', name: 'French', label: 'French (🇫🇷)', emoji: '🇫🇷' },
  { id: 'role_lang_en', name: 'English', label: 'English (🇬🇧)', emoji: '🇬🇧' },
  { id: 'role_playstation', name: 'PlayStation', label: 'PlayStation', emoji: '🎮' },
  { id: 'role_xbox', name: 'Xbox', label: 'Xbox', emoji: '⏹️' },
  { id: 'role_pc', name: 'PC', label: 'PC', emoji: '🖥️' },
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

  const rechercheInput = new TextInputBuilder()
    .setCustomId('welcome:recherche')
    .setLabel('Ce que tu cherches sur le serveur')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Lives, équipes, news GTA VI, discussions...')
    .setRequired(true)
    .setMaxLength(100)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(pseudoInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(plateformeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(rechercheInput),
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
  const plateforme = interaction.fields.getTextInputValue('welcome:plateforme')
  const recherche = interaction.fields.getTextInputValue('welcome:recherche')

  const userId = interaction.user.id
  const guildId = interaction.guild?.id

  try {
    if (guildId) {
      await updateProfile(userId, guildId, {
        bio: `Pseudo GTA: ${pseudo} | Plateforme: ${plateforme} | Recherche: ${recherche}`,
        platform: plateforme,
      })
    }
  } catch (error) {
    deps.logger.error({ userId, guildId, error: String(error) }, 'Welcome survey profile update failed')
  }

  await interaction.reply({
    content:
      'Merci pour tes réponses ! Ton profil a été mis à jour.\n' +
      'N\'oublie pas de choisir tes rôles avec le sélecteur ci-dessus.\n\n' +
      'Thank you for your answers! Your profile has been updated.\n' +
      "Don't forget to pick your roles with the selector above.",
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

  const guildRoles = await guild.roles.fetch()

  const toAdd: Role[] = []
  const toRemove: Role[] = []

  // Rôles actuellement détenus par le membre parmi les rôles auto-assignables
  const currentIds = new Set(
    member.roles.cache
      .filter((r) => AUTO_ROLES.some((ar) => ar.id === r.id))
      .map((r) => r.id),
  )

  for (const roleId of AUTO_ROLES.map((r) => r.id)) {
    const role = guildRoles.get(roleId)
    if (!role) continue
    if (selectedValues.includes(roleId)) {
      if (!currentIds.has(roleId)) toAdd.push(role)
    } else {
      if (currentIds.has(roleId)) toRemove.push(role)
    }
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

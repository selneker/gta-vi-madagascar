import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { preview as previewSetup, apply as applySetup, audit as auditSetup } from '../services/server-setup.js'
import { logger } from '../lib/logger.js'
import { PermissionBits } from '../config/permissions.js'

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Provision and audit the GTA VI MADAGASCAR server structure')
  .addSubcommand((sub) => sub.setName('preview').setDescription("Preview structural changes without applying them"))
  .addSubcommand((sub) => sub.setName('apply').setDescription('Apply the configured server structure (idempotent)'))
  .addSubcommand((sub) => sub.setName('audit').setDescription('Audit the current guild against the desired configuration'))
  // /setup is an administration action: restrict to server administrators.
  .setDefaultMemberPermissions(PermissionBits.ADMINISTRATOR)

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: { db: unknown; logger: typeof logger }
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Cette commande ne fonctionne que dans un serveur / This command only works inside a server.', ephemeral: true })
    return
  }

  await interaction.deferReply({ ephemeral: true })
  const subcommand = interaction.options.getSubcommand(true)

  let result: any
  try {
    if (subcommand === 'preview') result = await previewSetup(interaction.guild)
    else if (subcommand === 'apply') result = await applySetup(interaction.guild)
    else result = await auditSetup(interaction.guild)
  } catch (error) {
    deps.logger.error({ subcommand, error: String(error) }, 'setup command failed')
    await interaction.editReply({ content: 'Échec de /setup / /setup command failed: check bot-logs.' })
    return
  }

  await interaction.editReply({ embeds: [buildEmbed(subcommand, result)] })
}

function buildEmbed(subcommand: string, result: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🛠️ /setup ${subcommand}`)
    .setColor(0xff00ff)
    .setTimestamp()
    .setFooter({ text: 'GTA VI MADAGASCAR — Server Setup' })

  if (subcommand === 'apply') {
    embed
      .addFields(
        { name: 'Appliqué', value: `Rôles: ${result.applied.roles}, Salons: ${result.applied.channels}`, inline: true },
        { name: 'Déjà en place', value: `Rôles: ${result.skipped.roles}, Salons: ${result.skipped.channels}`, inline: true }
      )
    if (result.warnings.length) embed.addFields({ name: 'Avertissements', value: result.warnings.join('\n') })
  } else {
    const roleCounts: Record<'create' | 'update' | 'unchanged', number> = { create: 0, update: 0, unchanged: 0 }
    const channelCounts: Record<'create' | 'update' | 'unchanged', number> = { create: 0, update: 0, unchanged: 0 }
    for (const r of result.roles) roleCounts[r.action as 'create' | 'update' | 'unchanged']++
    for (const c of result.channels) channelCounts[c.action as 'create' | 'update' | 'unchanged']++
    embed.addFields(
      { name: 'Rôles', value: `Créer: ${roleCounts.create}, Mettre à jour: ${roleCounts.update}, Sans changement: ${roleCounts.unchanged}`, inline: true },
      { name: 'Salons', value: `Créer: ${channelCounts.create}, Mettre à jour: ${channelCounts.update}, Sans changement: ${channelCounts.unchanged}`, inline: true }
    )
    const previews = [...result.roles, ...result.channels].filter((p: any) => p.action !== 'unchanged').slice(0, 10)
    if (previews.length) {
      embed.addFields({
        name: 'Modifications prévues',
        value: previews.map((p: any) => `• ${p.action === 'create' ? '+' : '~'} ${p.def.name}`).join('\n'),
      })
    }
    if (result.warnings.length) embed.addFields({ name: 'Avertissements', value: result.warnings.join('\n') })
  }
  return embed
}

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js'
import { logger } from '../lib/logger.js'

/**
 * Mandy — personnage inspiré de l'univers GTA VI / Vice City / Leonida.
 * Réponses 100% gratuites, basées sur des templates (aucune clé API requise).
 * Structurée pour permettre de brancher plus tard une vraie IA (Anthropic/OpenAI)
 * si une clé gratuite est disponible.
 */

export const data = new SlashCommandBuilder()
  .setName('mandy')
  .setDescription('Parle avec Mandy, ton guide GTA VI / Talk to Mandy, your GTA VI guide')
  .addStringOption((opt) =>
    opt
      .setName('message')
      .setDescription('Ton message à Mandy / Your message to Mandy')
      .setRequired(true)
      .setMaxLength(500),
  )

const MANDY_INTRO_FR = "Salut, chérie ! Je suis Mandy, ton guide sur GTA VI à Vice City / Leonida. "
const MANDY_INTRO_EN = "Hey there, honey! I'm Mandy, your GTA VI guide in Vice City / Leonida. "
const MANDY_INTRO_MG = "Salama, omy ! Izaho dia Mandy, mpanampy GTA VI ao amin'ny Vice City / Leonida. "

const MANDY_RESPONSES_FR = [
  "À Vice City, le soleil tape dur et les rumeurs sur GTA VI volent aussi vite que les voitures de sport. Tu veux savoir quoi, chérie ?",
  "Leonida, c'est le paradis des fuites et des théories. J'ai entendu dire que... mais chut, c'est entre nous !",
  "Les lives GTA VI, c'est par ici. Prépare ta manette et ton meilleur sourire pour la caméra !",
  "Tu cherches des news ? Reste connecté, je surveille tout ce qui bouge dans le monde de GTA.",
  "GTA VI, c'est pas juste un jeu, c'est toute une ambiance. Et moi, je suis là pour toi.",
]

const MANDY_RESPONSES_EN = [
  "In Vice City, the sun burns hard and GTA VI rumors fly faster than sports cars. What do you want to know, honey?",
  "Leonida is the paradise of leaks and theories. I heard that... but shh, it's between us!",
  "GTA VI livestreams are right here. Grab your controller and your best smile for the camera!",
  "Looking for news? Stay tuned, I'm watching everything moving in the GTA world.",
  "GTA VI isn't just a game, it's a whole vibe. And I'm here for you.",
]

const MANDY_RESPONSES_MG = [
  "Ao amin'ny Vice City, ny masoandro dia mety missy sy ny fanontaniana GTA VI dia avy mandritra ny fiara vaovaovao. Inona no naingoanao, omy?",
  "Leonida, dia toerana masina amin'ny fanontaniana sy ny fifidiriana. Nahilavy aho fa... chut, izany no ao anatinay !",
  "Ny lives GTA VI dia ity ! Manao rafitra ny ropa-pahasalamanao sy ny fisorohana vaovao ao amin'ny kamera!",
  "Mifanaja olana ? Mifanankarena, dia manerana aho ny anleha ao amin'ny tontolon-kevitra GTA.",
  "GTA VI, tsy nahitaa ny trano fitaratra, toy ny ankarakoa ankehitriny sy izany ! ary aho, dia miraperaka ve ianao.",
]

function detectLanguage(message: string): 'FR' | 'EN' | 'MG' {
  const mgMarkers = ['salama', 'i no', 'ny ', 'ka ', 'na ', 'inona', 'mahafantatra']
  const enMarkers = ['hello', 'hi ', 'what', 'gta', 'vice', 'leonida', 'news', 'help']
  const frMarkers = ['salut', 'bonjour', 'gta', 'vice', 'leonida', 'news', 'aide', 'sais']

  const lower = message.toLowerCase()
  let mgScore = 0,
    enScore = 0,
    frScore = 0

  for (const m of mgMarkers) if (lower.includes(m)) mgScore++
  for (const m of enMarkers) if (lower.includes(m)) enScore++
  for (const m of frMarkers) if (lower.includes(m)) frScore++

  if (mgScore > enScore && mgScore > frScore) return 'MG'
  if (enScore > frScore) return 'EN'
  return 'FR'
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: { db: unknown; logger: typeof logger },
): Promise<void> {
  const message = interaction.options.getString('message', true)
  const lang = detectLanguage(message)

  const intro = lang === 'MG' ? MANDY_INTRO_MG : lang === 'EN' ? MANDY_INTRO_EN : MANDY_INTRO_FR
  const responses = lang === 'MG' ? MANDY_RESPONSES_MG : lang === 'EN' ? MANDY_RESPONSES_EN : MANDY_RESPONSES_FR

  // Réponse pseudo-aléatoire déterministe basée sur le message (pas de vrai hasard, pour la reproductibilité)
  let hash = 0
  for (let i = 0; i < message.length; i++) {
    hash = (hash << 5) - hash + message.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % responses.length

  const response = intro + responses[index]

  const embed = new EmbedBuilder()
    .setTitle('🍸 Mandy — GTA VI Guide')
    .setDescription(response)
    .setColor(0xff00ff)
    .setTimestamp()
    .setFooter({
      text: 'Mandy — Personnage gratuit / Free persona (pas de clé API requise / No API key required)',
    })

  await interaction.reply({ embeds: [embed] })
  deps.logger.info({ user: interaction.user.id, lang, messageLength: message.length }, 'Mandy responded')
}

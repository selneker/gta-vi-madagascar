import { Client, GatewayIntentBits, Events, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js'
import { logger } from './lib/logger.js'
import { db, disconnectDb } from './lib/db.js'
import { commands, modalHandlers } from './commands/index.js'
import { registerReadyEvents } from './events/ready.js'
import { registerVoiceStateEvents } from './events/voice-state.js'

export interface BotDeps {
  db: typeof db
  logger: typeof logger
}

export class GtaMadagascarBot {
  private readonly client: Client
  private readonly commands = new Map<string, (interaction: ChatInputCommandInteraction, deps: BotDeps) => Promise<void>>()
  private readonly modals = new Map<string, (interaction: ModalSubmitInteraction, deps: BotDeps) => Promise<void>>()

  constructor() {
    // Slash commands, modals and voice-state events only. The privileged
    // GuildMembers / MessageContent intents are intentionally NOT requested:
    // they must be enabled in the Discord Developer Portal and the bot has no
    // message listeners, so requesting them only causes a 4014 at login.
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildScheduledEvents,
      ],
    })

    for (const command of commands) {
      this.commands.set(command.data.name, command.execute as (interaction: ChatInputCommandInteraction, deps: BotDeps) => Promise<void>)
    }

    for (const handler of modalHandlers) {
      this.modals.set(handler.customId, handler.handle as (interaction: ModalSubmitInteraction, deps: BotDeps) => Promise<void>)
    }

    this.client.on(Events.InteractionCreate, (interaction) => this.handleInteraction(interaction))
    registerReadyEvents(this.client)
    registerVoiceStateEvents(this.client)
  }

  async start(token: string): Promise<void> {
    await this.client.login(token)
  }

  async stop(): Promise<void> {
    await this.client.destroy()
    await disconnectDb()
  }

  private async handleInteraction(interaction: unknown): Promise<void> {
    // Modal submissions (e.g. /live start form, /streamer apply form)
    if (interaction instanceof ModalSubmitInteraction) {
      const handler = this.modals.get(interaction.customId)
      if (!handler) return
      try {
        await handler(interaction, { db, logger })
      } catch (error) {
        logger.error({ modal: interaction.customId, error: String(error) }, 'Modal handler failed')
        const content = 'Une erreur est survenue / An error occurred while processing this form.'
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true })
        } else {
          await interaction.reply({ content, ephemeral: true })
        }
      }
      return
    }

    const chatInput = interaction as ChatInputCommandInteraction
    if (!chatInput.isChatInputCommand || !chatInput.isChatInputCommand()) return

    const handler = this.commands.get(chatInput.commandName)
    if (!handler) {
      if (chatInput.isChatInputCommand()) {
        await chatInput.reply({ content: 'Commande inconnue / Unknown command.', ephemeral: true })
      }
      return
    }

    try {
      await handler(chatInput, { db, logger })
    } catch (error) {
      logger.error({ command: chatInput.commandName, error: String(error) }, 'Command failed')
      const content = 'Une erreur est survenue / An error occurred while running this command.'
      if (chatInput.replied || chatInput.deferred) {
        await chatInput.followUp({ content, ephemeral: true })
      } else {
        await chatInput.reply({ content, ephemeral: true })
      }
    }
  }
}

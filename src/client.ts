import { Client, GatewayIntentBits, Events, ChatInputCommandInteraction, ModalSubmitInteraction, MessageComponentInteraction } from 'discord.js'
import { logger } from './lib/logger.js'
import { db, disconnectDb } from './lib/db.js'
import { commands, modalHandlers, componentHandlers } from './commands/index.js'
import { registerReadyEvents } from './events/ready.js'
import { registerVoiceStateEvents } from './events/voice-state.js'
import { registerWelcomeEvents } from './events/welcome.js'

export interface BotDeps {
  db: typeof db
  logger: typeof logger
}

export class GtaMadagascarBot {
  private readonly client: Client
  private readonly commands = new Map<string, (interaction: ChatInputCommandInteraction, deps: BotDeps) => Promise<void>>()
  private readonly modals = new Map<string, (interaction: ModalSubmitInteraction, deps: BotDeps) => Promise<void>>()
  private readonly components = new Map<string, (interaction: MessageComponentInteraction, deps: BotDeps) => Promise<void>>()

  constructor() {
    // Slash commands, modals, voice-state and member-join events.
    // The privileged GuildMembers intent IS now requested: it is required to
    // detect new members and post the welcome survey. It must be enabled in
    // the Discord Developer Portal (Privileged Gateway Intents).
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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

    for (const handler of componentHandlers) {
      this.components.set(handler.customId, handler.handle as (interaction: MessageComponentInteraction, deps: BotDeps) => Promise<void>)
    }

    this.client.on(Events.InteractionCreate, (interaction) => this.handleInteraction(interaction))
    registerReadyEvents(this.client)
    registerVoiceStateEvents(this.client)
    registerWelcomeEvents(this.client)
  }

  async start(token: string): Promise<void> {
    await this.client.login(token)
  }

  async stop(): Promise<void> {
    await this.client.destroy()
    await disconnectDb()
  }

  private async handleInteraction(interaction: unknown): Promise<void> {
    // Modal submissions (e.g. /live start form, /streamer apply form, welcome survey)
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

    // Message components (buttons, select menus)
    if (interaction instanceof MessageComponentInteraction) {
      const handler = this.components.get(interaction.customId)
      if (!handler) return
      try {
        await handler(interaction, { db, logger })
      } catch (error) {
        logger.error({ component: interaction.customId, error: String(error) }, 'Component handler failed')
        const content = 'Une erreur est survenue / An error occurred while processing this interaction.'
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

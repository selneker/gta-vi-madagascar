import type { Logger } from 'pino'
import { data as setupData, execute as setupExecute } from './setup.js'
import { data as liveData, execute as liveExecute, handleLiveStartModal } from './live.js'
import { data as streamerData, execute as streamerExecute, handleStreamerApplyModal } from './streamer.js'
import {
  data as newsData,
  execute as newsExecute,
  handleNewsSubmitModal,
  newsSubmitModalCustomId,
  newsEditModalCustomId,
} from './news.js'
import { data as communityData, execute as communityExecute } from './community.js'
import { data as mandyData, execute as mandyExecute } from './mandy.js'
import {
  handleWelcomeSurveyButton,
  handleWelcomeSurveyModal,
  handleRoleSelect,
  welcomeSurveyModalCustomId,
} from './welcome.js'

export interface Command {
  data: { toJSON: () => unknown; name: string }
  execute: (interaction: any, deps: { db: unknown; logger: Logger }) => Promise<void>
}

export interface ModalHandler {
  customId: string
  handle: (interaction: any, deps: { db: unknown; logger: Logger }) => Promise<void>
}

export interface ComponentHandler {
  customId: string
  handle: (interaction: any, deps: { db: unknown; logger: Logger }) => Promise<void>
}

export const commands: Command[] = [
  { data: setupData, execute: setupExecute },
  { data: liveData, execute: liveExecute },
  { data: streamerData, execute: streamerExecute },
  { data: newsData, execute: newsExecute },
  { data: communityData, execute: communityExecute },
  { data: mandyData, execute: mandyExecute },
]

export const modalHandlers: ModalHandler[] = [
  { customId: 'live:start', handle: handleLiveStartModal },
  { customId: 'streamer:apply', handle: handleStreamerApplyModal },
  { customId: newsSubmitModalCustomId, handle: handleNewsSubmitModal },
  { customId: newsEditModalCustomId, handle: handleNewsSubmitModal },
  { customId: welcomeSurveyModalCustomId, handle: handleWelcomeSurveyModal },
]

export const componentHandlers: ComponentHandler[] = [
  { customId: 'welcome:survey', handle: handleWelcomeSurveyButton },
  { customId: 'welcome:roles', handle: handleRoleSelect },
]

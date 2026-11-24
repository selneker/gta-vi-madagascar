/**
 * Configuration-driven definition of the GTA VI MADAGASCAR server structure.
 * This is the single source of truth for /setup preview / /setup apply / /setup audit.
 *
 * Roles are listed in hierarchy order (position 1 = lowest). The @everyone role
 * is managed by Discord and is never created or deleted by this system.
 * Channel types map to Discord native channel types:
 *   category, text (GUILD_TEXT), voice (GUILD_VOICE), stage (GUILD_STAGE_VOICE),
 *   news (GUILD_NEWS).
 */

export interface RoleDef {
  id: string
  name: string
  color?: string // hex
  hoist?: boolean
  mentionable?: boolean
  position: number
  permissions: string[]
}

export interface ChannelDef {
  id: string
  name: string
  type: 'category' | 'text' | 'voice' | 'stage' | 'news'
  category?: string // parent category id key
  topic?: string
  position?: number
  nsfw?: boolean
}

export const Roles: RoleDef[] = [
  // --- Administration ---
  { id: 'role_founder', name: 'Founder', color: '#FF00FF', hoist: true, mentionable: false, position: 100, permissions: ['ADMINISTRATOR'] },
  { id: 'role_cofounder', name: 'Co-Founder', color: '#FF00FF', hoist: true, mentionable: false, position: 99, permissions: ['ADMINISTRATOR'] },
  { id: 'role_administrator', name: 'Administrator', color: '#8A2BE2', hoist: true, mentionable: false, position: 98, permissions: ['ADMINISTRATOR'] },
  { id: 'role_community_manager', name: 'Community Manager', color: '#8A2BE2', hoist: true, mentionable: true, position: 97, permissions: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_EVENTS', 'MANAGE_MESSAGES', 'VIEW_AUDIT_LOG', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MODERATE_MEMBERS', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'] },
  // --- Moderation ---
  { id: 'role_head_mod', name: 'Head Moderator', color: '#00FFFF', hoist: true, mentionable: true, position: 80, permissions: ['MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_EVENTS', 'MANAGE_MESSAGES', 'VIEW_AUDIT_LOG', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MODERATE_MEMBERS', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'] },
  { id: 'role_moderator', name: 'Moderator', color: '#00FFFF', hoist: false, mentionable: true, position: 79, permissions: ['MANAGE_MESSAGES', 'VIEW_AUDIT_LOG', 'KICK_MEMBERS', 'MODERATE_MEMBERS', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'USE_VAD'] },
  { id: 'role_trial_mod', name: 'Trial Moderator', color: '#00FFFF', hoist: false, mentionable: false, position: 78, permissions: ['MANAGE_MESSAGES', 'VIEW_AUDIT_LOG', 'MODERATE_MEMBERS', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  // --- Live ---
  { id: 'role_live_director', name: 'Live Director', color: '#FF00FF', hoist: true, mentionable: false, position: 70, permissions: ['MANAGE_CHANNELS', 'MANAGE_EVENTS', 'MANAGE_MESSAGES', 'VIEW_AUDIT_LOG', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'REQUEST_TO_SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS'] },
  { id: 'role_stage_mod', name: 'Stage Moderator', color: '#00FFFF', hoist: true, mentionable: true, position: 69, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'REQUEST_TO_SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS', 'MANAGE_CHANNELS'] },
  { id: 'role_live_host', name: 'Live Host', color: '#00FFFF', hoist: false, mentionable: false, position: 68, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'REQUEST_TO_SPEAK'] },
  { id: 'role_guest_speaker', name: 'Guest Speaker', color: '#8A2BE2', hoist: false, mentionable: false, position: 67, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'REQUEST_TO_SPEAK'] },
  { id: 'role_verified_streamer', name: 'Verified Streamer', color: '#00FFFF', hoist: false, mentionable: false, position: 66, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'] },
  { id: 'role_live_alerts', name: 'Live Alerts', color: '#FF00FF', hoist: false, mentionable: true, position: 65, permissions: ['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY'] },
  // --- Newsroom ---
  { id: 'role_news_editor', name: 'News Editor', color: '#00FFFF', hoist: false, mentionable: false, position: 60, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  { id: 'role_news_approver', name: 'News Approver', color: '#00FFFF', hoist: false, mentionable: false, position: 59, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'MANAGE_MESSAGES', 'CONNECT', 'SPEAK'] },
  // --- Community ---
  { id: 'role_member', name: 'Member', color: '#FFFFFF', hoist: true, mentionable: false, position: 40, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'USE_EXTERNAL_EMOJIS'] },
  { id: 'role_veteran', name: 'Veteran', color: '#00FFFF', hoist: false, mentionable: false, position: 41, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'USE_EXTERNAL_EMOJIS'] },
  { id: 'role_og_member', name: 'OG Member', color: '#8A2BE2', hoist: false, mentionable: false, position: 42, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'USE_EXTERNAL_EMOJIS'] },
  { id: 'role_vip', name: 'VIP', color: '#FF00FF', hoist: false, mentionable: false, position: 43, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'USE_EXTERNAL_EMOJIS'] },
  { id: 'role_content_creator', name: 'Content Creator', color: '#00FFFF', hoist: false, mentionable: false, position: 44, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD', 'USE_EXTERNAL_EMOJIS'] },
  // --- Gaming ---
  { id: 'role_gta6_player', name: 'GTA VI Player', color: '#FF00FF', hoist: false, mentionable: false, position: 30, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  { id: 'role_gtao_player', name: 'GTA Online Player', color: '#00FFFF', hoist: false, mentionable: false, position: 29, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  { id: 'role_gta5_player', name: 'GTA V Player', color: '#8A2BE2', hoist: false, mentionable: false, position: 28, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  { id: 'role_playstation', name: 'PlayStation', color: '#00FFFF', hoist: false, mentionable: false, position: 20, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  { id: 'role_xbox', name: 'Xbox', color: '#00FFFF', hoist: false, mentionable: false, position: 19, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  { id: 'role_pc', name: 'PC', color: '#00FFFF', hoist: false, mentionable: false, position: 18, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'CONNECT', 'SPEAK'] },
  // --- Languages ---
  { id: 'role_lang_mg', name: 'Malagasy', color: '#FFFFFF', hoist: false, mentionable: false, position: 10, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'] },
  { id: 'role_lang_fr', name: 'French', color: '#FFFFFF', hoist: false, mentionable: false, position: 9, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'] },
  { id: 'role_lang_en', name: 'English', color: '#FFFFFF', hoist: false, mentionable: false, position: 8, permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY'] },
]

export const Channels: ChannelDef[] = [
  // --- START HERE ---
  { id: 'cat_start', name: '🏝️・start-here', type: 'category', position: 1 },
  { id: 'ch_welcome', name: 'welcome', type: 'text', category: 'cat_start', topic: 'Bienvenue / Welcome / Welcome — commencez ici. Lisez les règles puis vérifiez votre compte.', position: 2 },
  { id: 'ch_rules', name: '📜・rules', type: 'text', category: 'cat_start', topic: 'Règles de la communauté GTA VI MADAGASCAR.', position: 3 },
  { id: 'ch_verify', name: '✅・verify', type: 'text', category: 'cat_start', topic: 'Vérification d\'accès au serveur.', position: 4 },
  { id: 'ch_roles', name: '🎭・choose-your-roles', type: 'text', category: 'cat_start', topic: 'Choisissez vos langues, plateformes et rôles d\'alerte live.', position: 5 },
  { id: 'ch_announcements', name: '📢・announcements', type: 'news', category: 'cat_start', topic: 'Annonces officielles de la communauté GTA VI MADAGASCAR.', position: 6 },

  // --- COMMUNITY ---
  { id: 'cat_community', name: '💬・community', type: 'category', position: 10 },
  { id: 'ch_general', name: 'general-chat', type: 'text', category: 'cat_community', topic: 'Discussion générale.', position: 11 },
  { id: 'ch_malagasy', name: '🇲🇬・malagasy-chat', type: 'text', category: 'cat_community', topic: 'Salon en malgache.', position: 12 },
  { id: 'ch_french', name: '🇫🇷・french-chat', type: 'text', category: 'cat_community', topic: 'Salon en français.', position: 13 },
  { id: 'ch_english', name: '🇬🇧・english-chat', type: 'text', category: 'cat_community', topic: 'Salon in English.', position: 14 },
  { id: 'ch_introductions', name: '👋・introductions', type: 'text', category: 'cat_community', topic: 'Présentez-vous à la communauté.', position: 15 },
  { id: 'ch_media', name: '📸・community-media', type: 'text', category: 'cat_community', topic: 'Captures d\'écran, clips et fan-art GTA.', position: 16 },

  // --- LIVE CENTER ---
  { id: 'cat_live', name: '🔴・live-center', type: 'category', position: 20 },
  { id: 'ch_live_lobby', name: '🔴・CREATE YOUR LIVE ROOM', type: 'voice', category: 'cat_live', topic: 'Rejoignez ce salon pour créer un salon vocal temporaire dédié à votre live.', position: 20 },
  { id: 'ch_live_schedule', name: '📅・live-schedule', type: 'text', category: 'cat_live', topic: 'Calendrier des diffusions en direct.', position: 21 },
  { id: 'ch_live_announcements', name: '📢・live-announcements', type: 'news', category: 'cat_live', topic: 'Annonces automatiques quand un live commence.', position: 22 },
  { id: 'ch_live_chat', name: '💬・live-chat', type: 'text', category: 'cat_live', topic: 'Discussion pendant les lives.', position: 23 },
  { id: 'ch_live_clips', name: '🎬・live-clips', type: 'text', category: 'cat_live', topic: 'Clips et temps forts des lives communautaires.', position: 24 },
  { id: 'ch_live_stage', name: '🎤・LIVE STAGE', type: 'stage', category: 'cat_live', topic: 'Événements en direct, interviews, talk-shows GTA VI.', position: 25 },
  { id: 'ch_stream_room_01', name: '🎮・STREAM ROOM 01', type: 'voice', category: 'cat_live', topic: 'Diffusion membre — partage de gameplay.', position: 26 },
  { id: 'ch_stream_room_02', name: '🎮・STREAM ROOM 02', type: 'voice', category: 'cat_live', topic: 'Diffusion membre — partage de gameplay.', position: 27 },
  { id: 'ch_squad_live', name: '👥・SQUAD LIVE', type: 'voice', category: 'cat_live', topic: 'Salon vocal d\'équipe — jouez ensemble.', position: 28 },

  // --- NEWSROOM ---
  { id: 'cat_newsroom', name: '📰・newsroom', type: 'category', position: 30 },
  { id: 'ch_gta_news', name: '📰・gta-news', type: 'news', category: 'cat_newsroom', topic: 'Informations GTA vérifiées uniquement — lecture seule pour les membres.', position: 31 },
  { id: 'ch_news_discussion', name: '💬・news-discussion', type: 'text', category: 'cat_newsroom', topic: 'Discutez des articles publiés dans #gta-news.', position: 32 },

  // --- GTA VI UNIVERSE ---
  { id: 'cat_gta', name: '🕹️・gta-vi-universe', type: 'category', position: 40 },
  { id: 'ch_gta6_general', name: 'gta-6-general', type: 'text', category: 'cat_gta', topic: 'Tout sur GTA VI.', position: 41 },
  { id: 'ch_vice_city', name: '🌴・vice-city', type: 'text', category: 'cat_gta', topic: 'Vice City / Leonida.', position: 42 },
  { id: 'ch_characters', name: '👤・characters', type: 'text', category: 'cat_gta', topic: 'Personnages de l\'univers GTA.', position: 43 },
  { id: 'ch_vehicles', name: '🚗・vehicles', type: 'text', category: 'cat_gta', topic: 'Véhicules.', position: 44 },
  { id: 'ch_missions', name: '📋・missions-and-story', type: 'text', category: 'cat_gta', topic: 'Missions et scénario.', position: 45 },
  { id: 'ch_theories', name: '🔍・theories-and-rumors', type: 'text', category: 'cat_gta', topic: 'Théories et rumeurs (non vérifiées).', position: 46 },

  // --- EVENTS ---
  { id: 'cat_events', name: '🎪・events', type: 'category', position: 50 },
  { id: 'ch_upcoming_events', name: '📅・upcoming-events', type: 'text', category: 'cat_events', topic: 'Événements à venir.', position: 51 },
  { id: 'ch_event_registration', name: '✍️・event-registration', type: 'text', category: 'cat_events', topic: 'Inscriptions aux événements.', position: 52 },
  { id: 'ch_challenges', name: '🏆・challenges', type: 'text', category: 'cat_events', topic: 'Défis communautaires.', position: 53 },
  { id: 'ch_leaderboard', name: '🏅・leaderboard', type: 'text', category: 'cat_events', topic: 'Classements.', position: 54 },
  { id: 'ch_hall_of_fame', name: '🌟・hall-of-fame', type: 'text', category: 'cat_events', topic: 'Temple de la renommée.', position: 55 },

  // --- GAMING ---
  { id: 'cat_gaming', name: '🎮・gaming', type: 'category', position: 60 },
  { id: 'ch_lfp', name: '🔍・looking-for-players', type: 'text', category: 'cat_gaming', topic: 'Cherchez des joueurs.', position: 61 },
  { id: 'ch_playstation', name: '🎮・playstation', type: 'text', category: 'cat_gaming', topic: 'Joueurs PlayStation.', position: 62 },
  { id: 'ch_xbox', name: '⏹️・xbox', type: 'text', category: 'cat_gaming', topic: 'Joueurs Xbox.', position: 63 },
  { id: 'ch_pc_gamers', name: '🖥️・pc-gamers', type: 'text', category: 'cat_gaming', topic: 'Joueurs PC.', position: 64 },
  { id: 'ch_squad_01', name: '👥・squad-01', type: 'voice', category: 'cat_gaming', topic: 'Escouade 01.', position: 65 },
  { id: 'ch_squad_02', name: '👥・squad-02', type: 'voice', category: 'cat_gaming', topic: 'Escouade 02.', position: 66 },

  // --- SUPPORT ---
  { id: 'cat_support', name: '🎧・support', type: 'category', position: 70 },
  { id: 'ch_create_ticket', name: '🎫・create-ticket', type: 'text', category: 'cat_support', topic: 'Ouvrir un ticket (support, signalement, partenariat, technique).', position: 71 },
  { id: 'ch_suggestions', name: '💡・suggestions', type: 'text', category: 'cat_support', topic: 'Proposez des idées pour la communauté.', position: 72 },
  { id: 'ch_reports', name: '⚠️・member-reports', type: 'text', category: 'cat_support', topic: 'Signalez un membre ou un problème.', position: 73 },

  // --- STAFF HQ ---
  { id: 'cat_staff', name: '🛡️・staff-hq', type: 'category', position: 80 },
  { id: 'ch_staff_room', name: '🔒・staff-room', type: 'text', category: 'cat_staff', topic: 'Salon privé de l\'équipe staff.', position: 81 },
  { id: 'ch_mod_logs', name: '🪵・mod-logs', type: 'text', category: 'cat_staff', topic: 'Logs de modération.', position: 82 },
  { id: 'ch_bot_logs', name: '🤖・bot-logs', type: 'text', category: 'cat_staff', topic: 'Logs du bot.', position: 83 },
  { id: 'ch_security_logs', name: '🚨・security-logs', type: 'text', category: 'cat_staff', topic: 'Événements de sécurité.', position: 84 },
  { id: 'ch_news_review', name: '📰・news-review', type: 'text', category: 'cat_staff', topic: 'Revue des articles de news avant publication.', position: 85 },
  { id: 'ch_live_management', name: '🔴・live-management', type: 'text', category: 'cat_staff', topic: 'Gestion du Live Center.', position: 86 },

  // --- CLAN / TEAMS ---
  { id: 'cat_clan_teams', name: '[CLAN / TEAMS]', type: 'category', position: 87 },
  { id: 'ch_presentation_teams', name: 'présentation-teams', type: 'text', category: 'cat_clan_teams', topic: 'Présentez votre team / clan', position: 88 },
  { id: 'ch_clan_recrutement', name: 'clan-recrutement', type: 'text', category: 'cat_clan_teams', topic: 'Recrutement de membres pour votre clan', position: 89 },
  { id: 'ch_recherche_clan', name: 'recherche-clan', type: 'text', category: 'cat_clan_teams', topic: 'Cherchez un clan à rejoindre', position: 90 },
  { id: 'ch_alliances', name: 'alliances', type: 'text', category: 'cat_clan_teams', topic: 'Alliances entre clans', position: 91 },

  // --- ROOM & SCRIMS ---
  { id: 'cat_room_scrims', name: '[ROOM & SCRIMS]', type: 'category', position: 92 },
  { id: 'ch_annonces_scrims', name: 'annonces-scrims', type: 'text', category: 'cat_room_scrims', topic: 'Annonces de scrims et matchs', position: 93 },
  { id: 'ch_room_wow', name: 'room-wow', type: 'text', category: 'cat_room_scrims', topic: 'Room scrim WOW', position: 94 },
  { id: 'ch_tdm', name: 'tdm', type: 'text', category: 'cat_room_scrims', topic: 'Room scrim Team Deathmatch', position: 95 },
  { id: 'ch_room_classique', name: 'room-classique', type: 'text', category: 'cat_room_scrims', topic: 'Room scrim classique', position: 96 },
  { id: 'ch_arbitre_vocal', name: 'arbitre-vocal', type: 'voice', category: 'cat_room_scrims', topic: 'Canal vocal des arbitres', position: 97 },
]

export function categoryById(id: string): ChannelDef | undefined {
  return Channels.find((c) => c.id === id && c.type === 'category')
}

export function channelById(id: string): ChannelDef | undefined {
  return Channels.find((c) => c.id === id)
}

export function channelsInCategory(categoryId: string): ChannelDef[] {
  return Channels.filter((c) => c.category === categoryId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

/** Role keys allowed to see staff channels. */
export const StaffRoleIds = [
  'role_founder', 'role_cofounder', 'role_administrator', 'role_community_manager',
  'role_head_mod', 'role_moderator', 'role_trial_mod',
]

/** Channels that must be announcement (news) channels natively. */
export const NewsChannelIds = ['ch_announcements', 'ch_live_announcements', 'ch_gta_news']

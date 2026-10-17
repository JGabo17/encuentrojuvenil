import prisma from './db.js';
import type { WallMessage, WallModerationItem } from '../types/index.js';

/**
 * Muro de mensajes en vivo (Stage).
 * - Filtro automático de lenguaje ofensivo (normaliza acentos, leetspeak, símbolos y letras repetidas).
 * - El admin puede ocultar mensajes, aprobar manualmente uno marcado, apagar el muro
 *   o ampliar la lista de palabras bloqueadas.
 * El estado es en memoria: es suficiente para la duración de un evento.
 */

const MAX_WALL_MESSAGES = 40;
const MAX_ADMIN_MESSAGES = 80;
const MAX_TEXT_LENGTH = 160;

// Palabras que se bloquean como palabra completa (evita falsos positivos tipo "Scunthorpe")
const BASE_WORDS = [
  // Español
  'puta', 'puto', 'putas', 'putos', 'puton', 'putita', 'mierda', 'mierdas', 'carajo', 'carajos', 'verga', 'vergas',
  'pendejo', 'pendeja', 'pendejos', 'pendejas', 'cabron', 'cabrona', 'cabrones', 'joder', 'jodete',
  'jodido', 'jodida', 'chingar', 'chingado', 'chingada', 'chingatumadre', 'culero', 'culera', 'marica', 'maricon',
  'maricones', 'zorra', 'zorras', 'perra', 'perras', 'idiota', 'idiotas', 'imbecil', 'imbeciles', 'estupido', 'estupida',
  'estupidos', 'estupidas', 'tarado', 'tarada', 'huevon', 'huevona', 'huevones', 'webon', 'weon', 'concha', 'conchatumadre',
  'ctm', 'csm', 'hdp', 'hijueputa', 'hijoputa', 'hijodeputa', 'malparido', 'malparida', 'gonorrea', 
  'cojudo', 'cojuda', 'cojudos', 'mamon', 'mamona', 'mamahuevo', 'pajero', 'pajera', 'pajeros', 'pene', 'pija', 'pijas',
  'polla', 'pollas', 'culo', 'culos', 'follar', 'violar', 'violacion', 'violador', 'cagar',
  'cagada', 'cagado', 'cagon', 'cagona', 'mongolo', 'mongola', 'retrasado', 'retrasada', 'subnormal', 'gilipollas',
  'capullo', 'cabeza de chorlito', 'porno', 'porn', 'orgia', 
  'suicidate', 'matate', 'muerete', 
  // Inglés
  'fuck', 'fucking', 'fucker', 'fucked', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'asshole', 'bastard', 'dick',
  'dickhead', 'cock', 'pussy', 'slut', 'whore', 'cunt', 'nigga', 'nigger', 'faggot', 'fag', 'retard', 'motherfucker',
  'wtf', 'stfu', 'kys', 
];

// Frases / raíces largas que se bloquean aunque vengan pegadas a otras letras
const BASE_SUBSTRINGS = [
  'hijueputa', 'hijoputa', 'hijodeputa', 'malparid', 'conchatumadre', 'chingatumadre', 
  'motherfuck', 'cabron', 'pendej', 'puta madre', 'putamadre', 'mierda', 'gilipoll', 'maricon', 'pajero', 'follar'
];

let wallEnabled = true;
let customWords: string[] = [];
const hiddenIds = new Set<string>();
const approvedIds = new Set<string>();

/** Pasa a minúsculas, quita acentos y símbolos, reemplaza leetspeak y colapsa letras repetidas */
function normalize(text: string): string {
  const leet: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '¡': 'i', '€': 'e', '+': 't'
  };
  return text
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((c) => leet[c] ?? c)
    .join('')
    .replace(/[^a-z\s]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1'); // "puuuuta" -> "puuta"
}

/** Variante aún más agresiva: sin espacios y con letras repetidas colapsadas a una sola */
function squash(text: string): string {
  return normalize(text).replace(/\s+/g, '').replace(/(.)\1+/g, '$1');
}

function squashWord(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const squashedTokens = tokens.map((t) => t.replace(/(.)\1+/g, '$1'));
  const squashedAll = squash(text);

  const words = [...BASE_WORDS, ...customWords];
  for (const raw of words) {
    const w = squashWord(raw);
    if (!w) continue;
    if (raw.includes(' ')) {
      if (squashedAll.includes(w)) return true;
      continue;
    }
    if (squashedTokens.includes(w)) return true;
    // Palabras separadas por espacios o puntos: "p u t a"
    if (w.length >= 4 && squashedAll.includes(w) && customWords.includes(raw)) return true;
  }

  for (const sub of BASE_SUBSTRINGS) {
    if (squashedAll.includes(squashWord(sub))) return true;
  }

  // Letras sueltas separadas: "p u t a", "m i e r d a"
  const spaced = normalized.replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');
  if (spaced !== normalized) {
    const spacedTokens = spaced.split(/\s+/).map((t) => t.replace(/(.)\1+/g, '$1'));
    for (const raw of words) {
      const w = squashWord(raw);
      if (w && !raw.includes(' ') && spacedTokens.includes(w)) return true;
    }
  }
  return false;
}

function trimText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_TEXT_LENGTH ? clean.slice(0, MAX_TEXT_LENGTH - 1) + '…' : clean;
}

export function isWallEnabled(): boolean {
  return wallEnabled;
}

export function setWallEnabled(enabled: boolean): boolean {
  wallEnabled = enabled;
  return wallEnabled;
}

export function getCustomWords(): string[] {
  return [...customWords];
}

export function setCustomWords(words: string[]): string[] {
  customWords = Array.from(
    new Set(
      words
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 2 && w.length <= 30)
    )
  ).slice(0, 100);
  return getCustomWords();
}

export function setMessageHidden(messageId: string, hidden: boolean) {
  if (hidden) {
    hiddenIds.add(messageId);
    approvedIds.delete(messageId);
  } else {
    hiddenIds.delete(messageId);
  }
}

export function setMessageApproved(messageId: string, approved: boolean) {
  if (approved) {
    approvedIds.add(messageId);
    hiddenIds.delete(messageId);
  } else {
    approvedIds.delete(messageId);
  }
}

export function clearWallState() {
  hiddenIds.clear();
  approvedIds.clear();
}

async function fetchRecentMessages(eventId: string | undefined, take: number) {
  return prisma.chatMessage.findMany({
    where: {
      content: { not: '' },
      ...(eventId ? { pairing: { eventId } } : {})
    },
    orderBy: { sentAt: 'desc' },
    take
  });
}

/** Mensajes visibles en el muro del Stage (ya filtrados). Orden cronológico. */
export async function getWallMessages(eventId?: string): Promise<WallMessage[]> {
  if (!wallEnabled) return [];
  const rows = await fetchRecentMessages(eventId, MAX_WALL_MESSAGES * 3);
  const visible: WallMessage[] = [];
  for (const m of rows) {
    const content = trimText(m.content || '');
    if (!content) continue;
    if (hiddenIds.has(m.id)) continue;
    const flagged = containsProfanity(content) || containsProfanity(m.senderName);
    if (flagged && !approvedIds.has(m.id)) continue;
    visible.push({
      id: m.id,
      content,
      senderName: m.senderName,
      senderTeamName: m.senderTeamName,
      sentAt: m.sentAt.toISOString()
    });
    if (visible.length >= MAX_WALL_MESSAGES) break;
  }
  return visible.reverse();
}

/** Vista completa para el administrador: incluye marcados y ocultos */
export async function getWallModeration(eventId?: string): Promise<WallModerationItem[]> {
  const rows = await fetchRecentMessages(eventId, MAX_ADMIN_MESSAGES);
  return rows.map((m: any) => {
    const flagged = containsProfanity(m.content || '') || containsProfanity(m.senderName || '');
    const hidden = hiddenIds.has(m.id);
    const approved = approvedIds.has(m.id);
    const onWall = wallEnabled && !hidden && (!flagged || approved);
    return {
      id: m.id,
      content: m.content,
      senderName: m.senderName,
      senderTeamName: m.senderTeamName,
      sentAt: m.sentAt.toISOString(),
      flagged,
      hidden,
      approved,
      onWall
    };
  });
}


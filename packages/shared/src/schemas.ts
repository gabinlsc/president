import { z } from 'zod';
import { MAX_PLAYERS } from './types/game';
import type { CardId } from './types/cards';
import type { CardsInput, CreateRoomInput, JoinRoomInput, ResumeInput } from './types/protocol';

export const MIN_SOLO_BOTS = 4;
export const MAX_SOLO_BOTS = MAX_PLAYERS - 1;
export const NAME_MAX_LENGTH = 24;

const name = z
  .string()
  .trim()
  .min(1, 'Choisissez un pseudo de 1 à 24 caractères.')
  .max(NAME_MAX_LENGTH, 'Choisissez un pseudo de 1 à 24 caractères.')
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'Le pseudo contient des caractères invalides.');

const cardId = z
  .string()
  .regex(/^(3|4|5|6|7|8|9|10|11|12|13|14|15)-(clubs|diamonds|hearts|spades)$/, 'Carte inconnue.')
  .transform((id) => id as CardId);

export const createRoomSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('online'), name }),
  z.object({
    mode: z.literal('solo'),
    name,
    bots: z
      .number({ error: `Choisissez entre ${MIN_SOLO_BOTS} et ${MAX_SOLO_BOTS} adversaires bots.` })
      .int(`Choisissez entre ${MIN_SOLO_BOTS} et ${MAX_SOLO_BOTS} adversaires bots.`)
      .min(MIN_SOLO_BOTS, `Choisissez entre ${MIN_SOLO_BOTS} et ${MAX_SOLO_BOTS} adversaires bots.`)
      .max(
        MAX_SOLO_BOTS,
        `Choisissez entre ${MIN_SOLO_BOTS} et ${MAX_SOLO_BOTS} adversaires bots.`,
      ),
  }),
]) satisfies z.ZodType<CreateRoomInput>;

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9A-F]{4}$/, 'Code de salon invalide.'),
  name,
}) satisfies z.ZodType<JoinRoomInput>;

export const resumeSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, 'Session invalide.'),
}) satisfies z.ZodType<ResumeInput>;

export const cardsSchema = z.object({
  cards: z
    .array(cardId)
    .min(1, 'Sélectionnez au moins une carte.')
    .max(4, 'Sélection de cartes invalide.')
    .refine((ids) => new Set(ids).size === ids.length, 'Sélection de cartes invalide.'),
}) satisfies z.ZodType<CardsInput>;

/** Parses untrusted socket input; throws an Error carrying the first user-facing message. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Demande invalide.');
  return result.data;
}

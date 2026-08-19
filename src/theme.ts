import { Verdict, RiskLevel } from './types';

export const colors = {
  bg: '#F4F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3F0',
  border: '#E2E8E4',
  text: '#12211A',
  textMuted: '#5C7268',
  textFaint: '#8A9C93',
  primary: '#0E9F6E',
  primaryDark: '#07805A',
  primarySoft: '#E4F5EE',
  shadow: '#0B2119',
};

/** One palette per verdict, reused by badges, rings and bars. */
export const verdictStyle: Record<
  Verdict,
  { label: string; short: string; color: string; soft: string; advice: string }
> = {
  safe: {
    label: 'Safe to eat',
    short: 'Safe',
    color: '#0E9F6E',
    soft: '#E4F5EE',
    advice: 'Good to eat regularly as part of a normal diet.',
  },
  moderate: {
    label: 'Mostly safe',
    short: 'Moderate',
    color: '#D9930B',
    soft: '#FDF3DC',
    advice: 'Fine in normal portions, but keep an eye on how often you eat it.',
  },
  limit: {
    label: 'Limit intake',
    short: 'Limit',
    color: '#E4670B',
    soft: '#FDEBDD',
    advice: 'Occasional treat only. Stay under the daily limit below.',
  },
  avoid: {
    label: 'Best avoided',
    short: 'Avoid',
    color: '#D02B2B',
    soft: '#FCE6E6',
    advice: 'Rarely, if at all. There are far better options in this category.',
  },
};

export const riskStyle: Record<
  RiskLevel,
  { label: string; color: string; soft: string }
> = {
  safe: { label: 'No concern', color: '#0E9F6E', soft: '#E4F5EE' },
  low: { label: 'Low risk', color: '#7A9A2E', soft: '#F0F5DF' },
  moderate: { label: 'Moderate risk', color: '#D9930B', soft: '#FDF3DC' },
  high: { label: 'High risk', color: '#D02B2B', soft: '#FCE6E6' },
};

export const processingLabel: Record<string, string> = {
  whole: 'Whole food',
  'minimally-processed': 'Minimally processed',
  processed: 'Processed',
  'ultra-processed': 'Ultra-processed',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const space = (n: number) => n * 4;

/** Cross-platform card elevation. */
export const cardShadow = {
  shadowColor: colors.shadow,
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

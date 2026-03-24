export const FLOWS = {
  dm: { id: 'dm', label: 'DM Flow', color: '#6366f1', description: 'Direct message to an AI employee' },
  channel: { id: 'channel', label: 'Channel', color: '#10b981', description: 'Multi-agent channel thread' },
  mention: { id: 'mention', label: '@Mention', color: '#f59e0b', description: 'Cross-agent mention flow' },
  outcome: { id: 'outcome', label: 'Outcome', color: '#f43f5e', description: 'Scheduled task execution' },
  oauth: { id: 'oauth', label: 'OAuth', color: '#06b6d4', description: 'Google OAuth integration flow' },
} as const;

export type FlowId = keyof typeof FLOWS;

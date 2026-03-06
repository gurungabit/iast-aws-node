const isDev = import.meta.env.DEV

export const config = {
  apiUrl: isDev ? 'http://localhost:3000' : '',
  wsUrl: isDev ? 'ws://localhost:3000' : `ws://${window.location.host}`,
  terminal: {
    rows: 43,
    cols: 80,
    fontSize: 14,
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
  },
} as const

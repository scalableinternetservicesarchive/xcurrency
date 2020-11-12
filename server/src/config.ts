export enum AppService {
  /**
   * Runs a background process every 10s.
   */
  BACKGROUND = 'BACKGROUND',
}

const services = (process.env.SERVICES || '').split(',') as AppService[]

function isProd() {
  return process.env.NODE_ENV === 'production'
}

function isServiceEnabled(svc: AppService) {
  return services.includes(svc)
}

export const Config = {
  isProd: isProd(),
  appName: process.env.APP_NAME || 'bespin',
  appserverPort: Number(process.env.APP_PORT || 3000),
  appserverTag: process.env.APPSERVER_TAG || 'local',
  honeyKey: process.env.HONEYCOMB_KEY || '3ebf1b9f559d527d8eb3b0e08d859a8e',
  honeyDatasets: (process.env.HONEYCOMB_DATASETS || 'op').split(',').map(d => (isProd() ? d : 'dev-' + d)),
  plaidClientKey: process.env.PLAID_CLIENT_KEY || '5f92801b3cd69a001204999a',
  plaidSandboxKey: process.env.PLAID_SANDBOX_KEY || 'e48ecaf259feb09f0c4bed217c5ddc',
  backgroundService: isServiceEnabled(AppService.BACKGROUND) ? true : !isProd(),
  wsUrl: process.env.WS_URL || 'ws://localhost:3000/graphqlsubscription',
  adminPassword: process.env.ADMIN_PASSWORD || 'password',
}

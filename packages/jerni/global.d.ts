declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: string;
    PORT: string;
    EVENTS_SERVER: string;
  }
}

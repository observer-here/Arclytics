export type Env = {
  DB: D1Database;
  USER_DB: D1Database;
  ARCSCAN_BASE: string;
  ARCSCAN_STATS: string;
  INGEST_SECRET?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  ARC_RPC?: string;
  MAGIC_SECRET_KEY?: string;
};

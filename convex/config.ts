import { type Config } from 'convex/server';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

export const convexConfig: Config = {
  url: CONVEX_URL,
};

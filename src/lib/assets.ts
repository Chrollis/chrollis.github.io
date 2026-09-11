/**
 * Path helpers. The deploy can be a user site at the root or a project site under
 * `/repo/`, so any runtime-built path goes through `BASE_URL`. Bundled assets should
 * just be imported; these helpers are for `public/`.
 */

export const BASE_URL = import.meta.env.BASE_URL

/** Turn a public/ relative path into a base-aware absolute path. */
export function assetUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`
}

/** Base-aware path for a site route, for RSS / canonical style URLs. */
export function withBase(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`
}

export const isProduction = import.meta.env.PROD
export const isDevelopment = import.meta.env.DEV

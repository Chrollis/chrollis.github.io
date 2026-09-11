/// <reference types="vite/client" />

/** Typed access to the environment variables this project reads. */
interface ImportMetaEnv {
  /** Access key for Web3Forms; injected from a GitHub Actions secret. */
  readonly VITE_WEB3FORMS_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

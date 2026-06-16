// Ambient module declarations for CDN ESM imports used at runtime (CodeMirror, languages, etc.)
// These keep TypeScript happy while the modules are dynamically imported from CDNs.

declare module 'https://cdn.jsdelivr.net/npm/*' {
  const value: any;
  export default value;
}

declare module 'https://cdn.jsdelivr.net/npm/*/+esm' {
  const value: any;
  export default value;
}

declare module 'https://cdn.jsdelivr.net/npm/*/dist/*' {
  const value: any;
  export default value;
}

declare module 'https://cdn.jsdelivr.net/*' {
  const value: any;
  export default value;
}

// Fallback for any full-URL dynamic imports
declare module '*https://*' {
  const value: any;
  export default value;
}

// Project-global lightweight type aliases for missing internal types referenced in UI
type MythosCryptoCoin = any;
type SolanaAssetSummary = any;
declare const defaultMetadataUri: string;


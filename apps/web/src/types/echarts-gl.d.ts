// echarts-gl ships no TypeScript declarations (verified: no `types`/`typings`
// field in its package.json, and no @types/echarts-gl package exists on npm).
// It's imported only for its side effect of registering GL chart/component
// types onto the shared echarts/core instance (see
// services/echarts.ts#getEChartsGL) — no named exports are ever used, so an
// empty ambient module declaration is sufficient to satisfy `moduleResolution:
// bundler` + strict mode's TS2307 ("Cannot find module ... or its
// corresponding type declarations").
declare module 'echarts-gl'

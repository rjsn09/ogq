// Explicit root route: [...path].ts handles only paths BELOW /api/canonical.
export { default } from './canonical/[...path]';
export const config = { api: { bodyParser: false } };

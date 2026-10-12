// Browser entry point; keep these exports for tests and integrations.
export { App } from './app.js';
export { setupLobby } from './lobby.js';
export { boot } from './boot.js';
import { boot } from './boot.js';

if (typeof document !== 'undefined') boot();

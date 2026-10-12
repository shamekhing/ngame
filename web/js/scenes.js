// Public scene API and state registry.
import { states } from './scenes/registry.js';
import { MenuState } from './scenes/menu-state.js';
import { IntroState } from './scenes/intro-state.js';
import { GameState } from './scenes/game-state.js';
import { NsfwState } from './scenes/outcome-state.js';
import { MatchOverState } from './scenes/match-state.js';
Object.assign(states, { MenuState, IntroState, GameState, NsfwState, MatchOverState });
export { State } from './scenes/base.js';
export { MenuState, IntroState, GameState, NsfwState, MatchOverState };
export { Camera } from './scenes/camera.js';
export { drawText } from './scenes/visuals.js';

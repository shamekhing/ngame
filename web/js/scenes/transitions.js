// Re-play host-directed screen transitions on the guest.
import { EV, CTL } from '../net/netcode.js';
import { states } from './registry.js';

/** transitions the host announces that any guest state has to re-play */
export function handleSharedNetEvent(app, sub, values = []) {
  switch (sub) {
    case EV.NSFW:
      if (!(app.state instanceof states.NsfwState)) app.state = new states.NsfwState(app, values[0]);
      return true;
    case EV.ROUND:
      app.match.round = values[0] || 1;
      if (values.length > 2) { app.match.guy = values[1]; app.match.girl = values[2]; }
      app.state = values[3] ? new states.IntroState(app) : new states.GameState(app);
      return true;
    case EV.MATCH_OVER:
      app.state = new states.MatchOverState(app, values[0] ? 'girl' : 'guy');
      return true;
    case EV.MENU:
      app.state = new states.MenuState(app);
      return true;
    case EV.REMATCH:
      app.startMatch();
      return true;
    case CTL.BYE:
      app.onPeerLeft();
      return true;
    default:
      return false;
  }
}

/**
 * In netplay only the host drives the flow: on the guest a key press on a
 * "press any key" screen is forwarded, and the host's own press comes back as
 * a transition. @returns {boolean} true when the press was forwarded.
 */
export function forwardKey(app) {
  const net = app.net;
  if (!net || net.isHost) return false;
  net.queueAction('continue');
  return true;
}


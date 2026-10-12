// Character selection and local/rematch menu buttons.
import { WINDOW_W, WINDOW_H } from '../config.js';
import { MenuState, MatchOverState } from '../scenes.js';

export function setupMenu(app, canvas, menuState) {
  const updatePicks = () => {
    for (const who of ['guy', 'girl']) {
      const pick = document.getElementById(`${who}Pick`);
      const chosen = app.roles.p1 === who;
      pick.setAttribute('aria-pressed', String(chosen));
      pick.querySelector('.pick-note').textContent = chosen ? 'You play' : '';
    }
  };
  for (const who of ['guy', 'girl']) {
    document.getElementById(`${who}Pick`).addEventListener('click', () => {
      if (app.state instanceof MenuState) app.state.pickCharacter(who);
      updatePicks();
    });
  }
  menuState.onRoles = updatePicks;
  document.getElementById('rematchBtn').addEventListener('click', () => {
    if (app.state instanceof MatchOverState) app.state.handleKey('Space');
  });
  document.getElementById('menuBtn').addEventListener('click', () => {
    if (app.state instanceof MatchOverState) app.state.handleKey('Enter');
  });
  document.getElementById('localBtn').addEventListener('click', () => app.startMatch());

  // tapping a character card on the menu picks that character
  canvas.addEventListener('pointerdown', (e) => {
    if (!(app.state instanceof MenuState)) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (WINDOW_W / rect.width);
    const y = (e.clientY - rect.top) * (WINDOW_H / rect.height);
    app.state.handleClick(x, y);
  });

  return updatePicks;
}

// Phone orientation and on-screen input controls.
import { P1_KEYS, P2_KEYS } from './config.js';

export function setupTouchControls(app, chrome) {
  // ---- on-screen controls; they push into the same input pipeline ----
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  app.isTouch = coarse;
  const controls = { coarse, allowPortrait: false };
  const requestLandscape = () => {
    if (!coarse) return;
    const lock = () => {
      if (screen.orientation && screen.orientation.lock) {
        return screen.orientation.lock('landscape').catch(() => {});
      }
      return Promise.resolve();
    };
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
      void lock();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {}).then(lock);
    }
  };
  app.onStartMatch = () => {
    controls.allowPortrait = false;
    requestLandscape();
  };
  app.shouldPause = () => !chrome.rotate.hidden;
  document.getElementById('rotateBtn').addEventListener('click', requestLandscape);
  document.getElementById('portraitBtn').addEventListener('click', () => {
    controls.allowPortrait = true;
    chrome.rotate.hidden = true;
  });
  const joystick = document.getElementById('joystick');
  const knob = joystick.querySelector('.joystick-knob');
  let joystickPointer = null;
  const moveJoystick = (e) => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width * 0.36;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const factor = distance > radius ? radius / distance : 1;
    const x = dx * factor / radius;
    const y = dy * factor / radius;
    const magnitude = Math.hypot(x, y);
    app.input.setAxis(magnitude < 0.12 ? 0 : x, magnitude < 0.12 ? 0 : y);
    knob.style.left = `${50 + x * 36}%`;
    knob.style.top = `${50 + y * 36}%`;
  };
  const releaseJoystick = (e) => {
    if (e && e.pointerId !== joystickPointer) return;
    joystickPointer = null;
    app.input.setAxis(0, 0);
    knob.style.left = '50%';
    knob.style.top = '50%';
  };
  joystick.addEventListener('pointerdown', (e) => {
    if (joystickPointer !== null) return;
    e.preventDefault();
    joystickPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    moveJoystick(e);
  });
  joystick.addEventListener('pointermove', (e) => {
    if (e.pointerId === joystickPointer) { e.preventDefault(); moveJoystick(e); }
  });
  joystick.addEventListener('pointerup', releaseJoystick);
  joystick.addEventListener('pointercancel', releaseJoystick);
  joystick.addEventListener('lostpointercapture', releaseJoystick);
  joystick.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => releaseJoystick());
  const localKeys = () => (app.net && app.net.localSeat === 'p1' ? P1_KEYS : P2_KEYS);
  for (const btn of document.querySelectorAll('#touch button')) {
    const code = () => localKeys()[btn.dataset.key];
    const press = (down) => (e) => {
      e.preventDefault();
      const c = code();
      if (c) app.input.setVirtual(c, down);
    };
    btn.addEventListener('pointerdown', press(true));
    btn.addEventListener('pointerup', press(false));
    btn.addEventListener('pointercancel', press(false));
    btn.addEventListener('pointerleave', press(false));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  controls.releaseJoystick = releaseJoystick;
  return controls;
}

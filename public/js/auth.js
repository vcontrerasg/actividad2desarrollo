import { $ } from './dom.js';
import { api } from './api.js';

export function initAuth(onSession) {
  $('btnLogin').onclick = async () => {
    try {
      const r = await api('/api/login', 'POST', { username: $('u').value, password: $('p').value });
      $('p').value = '';
      onSession(r.username);
    } catch (e) {
      $('authMsg').textContent = e.message;
    }
  };

  $('btnReg').onclick = async () => {
    try {
      await api('/api/registro', 'POST', { username: $('u').value, password: $('p').value });
      $('authMsg').textContent = 'Registro exitoso, ya puedes iniciar sesión.';
    } catch (e) {
      $('authMsg').textContent = e.message;
    }
  };

  $('btnLogout').onclick = async () => {
    await api('/api/logout', 'POST');
    onSession(null);
  };

  api('/api/me').then((r) => onSession(r.username)).catch(() => onSession(null));
}

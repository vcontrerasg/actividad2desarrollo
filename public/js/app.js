import { $ } from './dom.js';
import { initAuth } from './auth.js';
import { initProductos, cargarProductos } from './productos.js';

function mostrarVista(username) {
  $('auth').classList.toggle('hidden', !!username);
  $('app').classList.toggle('hidden', !username);
  $('userbox').classList.toggle('hidden', !username);
  $('who').textContent = username || '';
  if (username) cargarProductos();
}

initProductos();
initAuth(mostrarVista);

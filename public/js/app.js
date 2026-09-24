import { $ } from './dom.js';
import { initAuth } from './auth.js';
import { initProductos, cargarProductos } from './productos.js';
import { initCategorias, cargarCategorias } from './categorias.js';
import { initMovimientos } from './movimientos.js';
import { cargarAuditoria } from './auditoria.js';

function mostrarVista(username) {
  $('auth').classList.toggle('hidden', !!username);
  $('app').classList.toggle('hidden', !username);
  $('userbox').classList.toggle('hidden', !username);
  $('who').textContent = username || '';
  if (username) {
    cargarCategorias()
      .then(cargarProductos)
      .then(cargarAuditoria)
      .catch((e) => { $('appMsg').textContent = e.message; });
  } else {
    $('movCard').classList.add('hidden');
  }
}

initProductos();
initMovimientos();
initCategorias();
initAuth(mostrarVista);

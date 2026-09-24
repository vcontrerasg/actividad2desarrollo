import { $ } from './dom.js';
import { api } from './api.js';

let productoActualId = null;

function fmtFecha(iso) {
  return new Date(iso).toLocaleString();
}

async function pintarMovimientos() {
  const items = await api('/api/productos/' + productoActualId + '/movimientos');
  const tbody = $('movRows');
  tbody.replaceChildren();
  for (const m of items) {
    const tr = document.createElement('tr');
    const tdFecha = document.createElement('td');
    tdFecha.textContent = fmtFecha(m.creadoEn);
    const tdTipo = document.createElement('td');
    tdTipo.textContent = m.tipo === 'entrada' ? 'Entrada' : 'Retiro';
    tdTipo.className = m.tipo === 'entrada' ? 'badge-entrada' : 'badge-salida';
    const tdCant = document.createElement('td');
    tdCant.textContent = m.cantidad;
    const tdMotivo = document.createElement('td');
    tdMotivo.textContent = m.motivo || '';
    const tdStock = document.createElement('td');
    tdStock.textContent = m.stockResultante;
    tr.append(tdFecha, tdTipo, tdCant, tdMotivo, tdStock);
    tbody.appendChild(tr);
  }
}

export function abrirMovimientos(producto, onCambioStock) {
  productoActualId = producto.id;
  $('movTitle').textContent = `Movimientos de stock — ${producto.nombre}`;
  $('movCard').classList.remove('hidden');
  $('movMsg').textContent = '';
  $('movCantidad').value = '';
  $('movMotivo').value = '';
  pintarMovimientos();

  $('btnMovSave').onclick = async () => {
    $('movMsg').textContent = '';
    try {
      const r = await api('/api/productos/' + productoActualId + '/movimientos', 'POST', {
        tipo: $('movTipo').value,
        cantidad: $('movCantidad').value,
        motivo: $('movMotivo').value,
      });
      $('movCantidad').value = '';
      $('movMotivo').value = '';
      await pintarMovimientos();
      onCambioStock(productoActualId, r.stock);
    } catch (e) {
      $('movMsg').textContent = e.message;
    }
  };

  $('movCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function initMovimientos() {
  $('btnMovClose').onclick = () => {
    productoActualId = null;
    $('movCard').classList.add('hidden');
  };
}
import { $ } from './dom.js';
import { api } from './api.js';
import { abrirMovimientos } from './movimientos.js';
import { cargarAuditoria } from './auditoria.js';

let editId = null;

export async function cargarProductos() {
  const items = await api('/api/productos');
  const tbody = $('rows');
  tbody.replaceChildren();

  for (const it of items) {
    const tr = document.createElement('tr');
    for (const v of [it.nombre, it.categoria || 'Sin categoría', it.descripcion, it.precio, it.stock]) {
      const td = document.createElement('td');
      td.textContent = v; // textContent evita XSS
      tr.appendChild(td);
    }

    const acciones = document.createElement('td');
    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.onclick = () => iniciarEdicion(it);

    const btnMov = document.createElement('button');
    btnMov.textContent = 'Stock';
    btnMov.onclick = () => abrirMovimientos(it, () => { cargarProductos(); cargarAuditoria(); });

    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.className = 'sec';
    btnEliminar.onclick = async () => {
      if (confirm('¿Eliminar?')) {
        await api('/api/productos/' + it.id, 'DELETE');
        cargarProductos();
        cargarAuditoria();
      }
    };

    acciones.append(btnEditar, ' ', btnMov, ' ', btnEliminar);
    tr.appendChild(acciones);
    tbody.appendChild(tr);
  }
}

function iniciarEdicion(it) {
  editId = it.id;
  $('formTitle').textContent = 'Editar producto';
  $('nombre').value = it.nombre;
  $('desc').value = it.descripcion || '';
  $('precio').value = it.precio;
  $('stock').value = it.stock;
  $('categoria').value = it.categoriaId ?? '';
}

function limpiarFormulario() {
  editId = null;
  $('formTitle').textContent = 'Nuevo producto';
  for (const id of ['nombre', 'desc', 'precio', 'stock', 'categoria']) $(id).value = '';
}

export function initProductos() {
  $('btnCancel').onclick = limpiarFormulario;

  $('btnSave').onclick = async () => {
    $('appMsg').textContent = '';
    const body = {
      nombre: $('nombre').value,
      descripcion: $('desc').value,
      precio: $('precio').value,
      stock: $('stock').value,
      categoriaId: $('categoria').value,
    };
    try {
      if (editId) await api('/api/productos/' + editId, 'PUT', body);
      else await api('/api/productos', 'POST', body);
      limpiarFormulario();
      cargarProductos();
      cargarAuditoria();
    } catch (e) {
      $('appMsg').textContent = e.message;
    }
  };
}

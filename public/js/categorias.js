import { $ } from './dom.js';
import { api } from './api.js';

let categorias = [];

export function getCategorias() {
  return categorias;
}

function pintarSelect() {
  const sel = $('categoria');
  const actual = sel.value;
  sel.replaceChildren();
  const optVacia = document.createElement('option');
  optVacia.value = '';
  optVacia.textContent = 'Sin categoría';
  sel.appendChild(optVacia);
  for (const c of categorias) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    sel.appendChild(opt);
  }
  if ([...sel.options].some((o) => o.value === actual)) sel.value = actual;
}

function pintarLista(onEliminar) {
  const ul = $('listaCategorias');
  ul.replaceChildren();
  for (const c of categorias) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = c.nombre;
    const btn = document.createElement('button');
    btn.textContent = '×';
    btn.setAttribute('aria-label', `Eliminar categoría ${c.nombre}`);
    btn.onclick = () => onEliminar(c.id);
    li.append(span, btn);
    ul.appendChild(li);
  }
}

async function refrescar() {
  categorias = await api('/api/categorias');
  pintarSelect();
  pintarLista(eliminar);
}

async function eliminar(id) {
  $('catMsg').textContent = '';
  try {
    await api('/api/categorias/' + id, 'DELETE');
    await refrescar();
  } catch (e) {
    $('catMsg').textContent = e.message;
  }
}

export function cargarCategorias() {
  return refrescar();
}

export function initCategorias() {
  $('btnAddCat').onclick = async () => {
    $('catMsg').textContent = '';
    const nombre = $('catNombre').value.trim();
    if (!nombre) return;
    try {
      await api('/api/categorias', 'POST', { nombre });
      $('catNombre').value = '';
      await refrescar();
    } catch (e) {
      $('catMsg').textContent = e.message;
    }
  };
}
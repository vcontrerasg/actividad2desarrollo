import { $ } from './dom.js';
import { api } from './api.js';

function fmtFecha(iso) {
  return new Date(iso).toLocaleString();
}

export async function cargarAuditoria() {
  const items = await api('/api/auditoria');
  const tbody = $('auditRows');
  tbody.replaceChildren();
  for (const a of items) {
    const tr = document.createElement('tr');
    for (const v of [fmtFecha(a.creadoEn), a.accion, a.entidad || '', a.detalle || '']) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}
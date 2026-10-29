/**
 * Libreta de Clase — puente con Google Sheets
 *
 * Guarda los datos de la libreta en esta planilla:
 *   - Hoja "_datos": un registro por grupo y por clase (no editar a mano).
 *   - Una hoja legible por grupo, con la libreta armada (se rehace sola en cada cambio).
 *
 * Instalación:
 *   1. Extensiones → Apps Script, pegá este código y cambiá CLAVE.
 *   2. Implementar → Nueva implementación → Aplicación web.
 *      Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 *   3. Copiá la URL que termina en /exec y pegala en la libreta junto con la clave.
 *
 * Si cambiás este código, hacé Implementar → Gestionar implementaciones → Editar → Nueva versión,
 * así la misma URL usa el código nuevo.
 */

const CLAVE = 'CAMBIAR-ESTA-CLAVE';
const HOJA_DATOS = '_datos';
const NOTA_APRUEBA = 5;
const MAX_CELDA = 49000; // Sheets admite hasta 50.000 caracteres por celda

const COLOR = { ok: '#dcf1e5', ape: '#f8ecc9', falta: '#f8e0de', tarde: '#f8ecc9', just: '#e8e4f8', cab: '#e9edf5' };
const VER = { P: 'P', A: 'A', T: 'T', J: 'J', S: '✓', M: '½', N: '✗', CMB: 'MB', CB: 'B', CR: 'R', CM: 'M' };

function doGet() {
  return salida({ ok: true, data: 'Libreta de Clase: el servicio está activo.' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); }
  catch (err) { return salida({ ok: false, error: 'pedido', mensaje: 'Pedido inválido.' }); }
  if (CLAVE === 'CAMBIAR-ESTA-CLAVE') return salida({ ok: false, error: 'sin_clave', mensaje: 'Todavía no cambiaste CLAVE en el script. Cambiala, guardá y creá una nueva versión de la implementación.' });
  if (req.clave !== CLAVE) return salida({ ok: false, error: 'clave', mensaje: 'La clave no coincide con la del script.' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return salida({ ok: false, error: 'unavailable', mensaje: 'La planilla está ocupada. Probá de nuevo en unos segundos.' });
  try {
    return salida({ ok: true, data: atender(req) });
  } catch (err) {
    return salida({ ok: false, error: 'script', mensaje: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function atender(req) {
  switch (req.accion) {
    case 'ping':
      hojaDatos();
      return { planilla: SpreadsheetApp.getActive().getName() };
    case 'grupos':
      return filas().filter(f => f.tipo === 'grupo').map(f => Object.assign({ id: f.grupo }, f.obj));
    case 'clases': {
      const o = {};
      filas().filter(f => f.tipo === 'clase' && f.grupo === req.grupo).forEach(f => { o[f.fecha] = f.obj; });
      return o;
    }
    case 'guardarGrupo':
      guardar('grupo', req.grupo, '', req.datos);
      hojaLegible(req.grupo);
      return true;
    case 'borrarGrupo':
      borrar(f => f.grupo === req.grupo);
      borrarHojaLegible(req.grupo);
      return true;
    case 'guardarClase':
      guardar('clase', req.grupo, req.clase.fecha, req.clase);
      hojaLegible(req.grupo);
      return true;
    case 'borrarClase':
      borrar(f => f.tipo === 'clase' && f.grupo === req.grupo && f.fecha === req.fecha);
      hojaLegible(req.grupo);
      return true;
    case 'importar':
      (req.grupos || []).forEach(gr => {
        const clases = gr.clases || {};
        const g = Object.assign({}, gr);
        const id = g.id;
        delete g.clases; delete g.id;
        guardar('grupo', id, '', g);
        Object.keys(clases).forEach(f => guardar('clase', id, f, Object.assign({}, clases[f], { fecha: f })));
        hojaLegible(id);
      });
      return true;
    default:
      throw new Error('Acción desconocida: ' + req.accion);
  }
}

/* ---------- hoja de datos ---------- */

let _filas = null; // caché durante un mismo pedido

function hojaDatos() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(HOJA_DATOS);
  if (!h) {
    h = ss.insertSheet(HOJA_DATOS);
    h.getRange(1, 1, 1, 5).setValues([['tipo', 'grupo', 'fecha', 'json', 'actualizado']]).setFontWeight('bold');
    h.getRange('C:C').setNumberFormat('@');
    h.setFrozenRows(1);
    h.setColumnWidth(4, 420);
  }
  return h;
}

function normFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

function filas() {
  if (_filas) return _filas;
  const h = hojaDatos();
  const n = h.getLastRow() - 1;
  _filas = [];
  if (n < 1) return _filas;
  h.getRange(2, 1, n, 4).getValues().forEach((r, i) => {
    if (!r[0]) return;
    let obj = {};
    try { obj = JSON.parse(r[3]); } catch (e) { return; }
    _filas.push({ fila: i + 2, tipo: String(r[0]), grupo: String(r[1]), fecha: normFecha(r[2]), obj: obj });
  });
  return _filas;
}

function guardar(tipo, grupo, fecha, obj) {
  if (!grupo) throw new Error('Falta el identificador del grupo.');
  const json = JSON.stringify(obj);
  if (json.length > MAX_CELDA) throw new Error('El registro es demasiado grande para una celda de Sheets (' + json.length + ' caracteres).');
  const h = hojaDatos();
  const valores = [[tipo, grupo, fecha, json, new Date()]];
  const f = filas().find(x => x.tipo === tipo && x.grupo === grupo && x.fecha === fecha);
  if (f) {
    h.getRange(f.fila, 1, 1, 5).setValues(valores);
    f.obj = obj;
  } else {
    const fila = h.getLastRow() + 1;
    h.getRange(fila, 3).setNumberFormat('@');
    h.getRange(fila, 1, 1, 5).setValues(valores);
    _filas.push({ fila: fila, tipo: tipo, grupo: grupo, fecha: fecha, obj: obj });
  }
}

function borrar(pred) {
  const h = hojaDatos();
  filas().filter(pred).map(f => f.fila).sort((a, b) => b - a).forEach(n => h.deleteRow(n));
  _filas = null;
}

/* ---------- hoja legible por grupo ---------- */

function propHoja(gid) { return 'hoja_' + gid; }

function buscarHoja(gid) {
  const id = PropertiesService.getDocumentProperties().getProperty(propHoja(gid));
  if (!id) return null;
  return SpreadsheetApp.getActive().getSheets().find(s => String(s.getSheetId()) === id) || null;
}

function nombreHoja(g, gid) {
  const base = String(g.nombre || 'Grupo').replace(/[\[\]\*\?\/\\:]/g, ' ').trim().slice(0, 80) || 'Grupo';
  const ss = SpreadsheetApp.getActive();
  const propia = buscarHoja(gid);
  let nombre = base, i = 2;
  while (ss.getSheetByName(nombre) && ss.getSheetByName(nombre) !== propia) nombre = base + ' (' + (i++) + ')';
  return nombre;
}

function hojaLegible(gid) {
  const fg = filas().find(f => f.tipo === 'grupo' && f.grupo === gid);
  if (!fg) return;
  const g = fg.obj;
  const ss = SpreadsheetApp.getActive();
  let h = buscarHoja(gid);
  const nombre = nombreHoja(g, gid);
  if (!h) {
    h = ss.insertSheet(nombre);
    PropertiesService.getDocumentProperties().setProperty(propHoja(gid), String(h.getSheetId()));
  } else if (h.getName() !== nombre) {
    h.setName(nombre);
  }

  const est = (g.estudiantes || []).filter(e => e.activo !== false);
  const cols = g.columnas || [];
  const clases = filas().filter(f => f.tipo === 'clase' && f.grupo === gid).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  const ancho = 3 + Math.max(est.length, 1);

  const vals = [], fondos = [];
  const fila = (arr, color) => {
    const r = arr.slice(0, ancho); while (r.length < ancho) r.push('');
    vals.push(r);
    fondos.push(r.map(() => color || null));
  };
  fila([g.nombre || 'Grupo']);
  fila(['Actualizado: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + ' · Notas de 1 a 10: aprueba con ' + NOTA_APRUEBA + ' o más; de 1 a 4 va al APE.']);
  fila(['fecha', 'tema', 'dato'].concat(est.map(e => e.nombre)), COLOR.cab);

  clases.forEach(cl => {
    const c = cl.obj, v = c.valores || {};
    const [y, m, d] = cl.fecha.split('-');
    cols.forEach((k, i) => {
      const r = [i === 0 ? d + '/' + m + '/' + y : '', i === 0 ? (c.tema || '') : '', k.nombre];
      const bg = [null, null, null];
      est.forEach(e => {
        const x = (v[e.id] || {})[k.id];
        if (x === undefined || x === '') { r.push(''); bg.push(null); return; }
        if (k.tipo === 'nota') { const n = Number(x); r.push(n); bg.push(n >= NOTA_APRUEBA ? COLOR.ok : COLOR.ape); }
        else if (k.tipo === 'asistencia' || k.tipo === 'entrega' || k.tipo === 'conducta') {
          r.push(VER[x] || x);
          bg.push({ P: COLOR.ok, S: COLOR.ok, A: COLOR.falta, N: COLOR.falta, T: COLOR.tarde, M: COLOR.tarde, J: COLOR.just, CMB: COLOR.ok, CB: COLOR.ok, CR: COLOR.tarde, CM: COLOR.falta }[x] || null);
        } else { r.push(String(x)); bg.push(null); }
      });
      while (r.length < ancho) { r.push(''); bg.push(null); }
      vals.push(r); fondos.push(bg);
    });
  });
  fila([]);
  fila(['Referencias: P presente · A ausente · T tarde · J justificada · ✓ hecho · ½ parcial · ✗ no hecho']);
  fila(['Conducta: MB muy buena · B buena · R regular · M mala']);

  h.clear();
  h.getRange(1, 1, vals.length, ancho).setValues(vals).setBackgrounds(fondos);
  h.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  h.getRange(2, 1).setFontColor('#5d6880');
  h.getRange(3, 1, 1, ancho).setFontWeight('bold');
  h.getRange(4, 4, Math.max(vals.length - 3, 1), Math.max(ancho - 3, 1)).setHorizontalAlignment('center');
  h.setFrozenRows(3);
  h.setFrozenColumns(3);
  h.setColumnWidth(1, 90); h.setColumnWidth(2, 220); h.setColumnWidth(3, 110);
  if (ancho > 3) h.setColumnWidths(4, ancho - 3, 120);
}

function borrarHojaLegible(gid) {
  const h = buscarHoja(gid);
  if (h) SpreadsheetApp.getActive().deleteSheet(h);
  PropertiesService.getDocumentProperties().deleteProperty(propHoja(gid));
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

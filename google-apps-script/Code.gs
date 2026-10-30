
/**
 * Libreta de Clase — puente con Google Sheets
 *
 * Guarda los datos de la libreta en esta planilla:
 *   - Hoja "_datos": un registro por grupo y por clase (no editar a mano).
 *   - Una hoja legible por grupo, con la libreta armada (se rehace sola en cada cambio).
 *   - Una hoja "Resumen" por grupo: una fila por estudiante con faltas, fictas y promedios.
 *
 * Instalación:
 *   1. Extensiones → Apps Script, pegá este código y guardá. En la planilla, recargala y usá
 *      el menú Libreta → Configurar clave (la clave queda guardada aparte: al pegar código nuevo no se pierde).
 *      También se puede escribir en CLAVE, abajo, como antes.
 *   2. Implementar → Nueva implementación → Aplicación web.
 *      Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 *   3. Copiá la URL que termina en /exec y pegala en la libreta junto con la clave.
 *
 * Para rehacer a mano las hojas de los grupos: menú Libreta → Rehacer hojas de los grupos.
 *
 * Si cambiás este código, hacé Implementar → Gestionar implementaciones → Editar → Nueva versión,
 * así la misma URL usa el código nuevo.
 */
 
const CLAVE = 'CAMBIAR-ESTA-CLAVE'; // opcional: si configurás la clave desde el menú Libreta, se usa esa
 
function claveActual() {
  return PropertiesService.getScriptProperties().getProperty('CLAVE') || CLAVE;
}
 
function configurarClave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Clave de la libreta', 'Escribí la clave que vas a usar en la libreta (la misma que pegás junto con la URL):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const c = r.getResponseText().trim();
  if (c.length < 4 || c === 'CAMBIAR-ESTA-CLAVE') { ui.alert('La clave tiene que tener al menos 4 caracteres.'); return; }
  PropertiesService.getScriptProperties().setProperty('CLAVE', c);
  ui.alert('Clave guardada. Ya funciona con la implementación que tenés; no hace falta crear una versión nueva.');
}
const HOJA_DATOS = '_datos';
const NOTA_APRUEBA = 5;
const VERSION = 5; // la libreta avisa si el script es más viejo
const LIMITE_DEF = 25; // % de faltas fictas si el grupo no tiene uno propio
const MAX_CELDA = 49000; // Sheets admite hasta 50.000 caracteres por celda
 
const COLOR = { aviso: '#f8ecc9', supera: '#f4c7c3', ok: '#dcf1e5', ape: '#f8ecc9', falta: '#f8e0de', tarde: '#f8ecc9', just: '#e8e4f8', cab: '#e9edf5' };
const VER = { P: 'P', A: 'A', T: 'T', J: 'J', S: '✓', M: '½', N: '✗', CMB: 'MB', CB: 'B', CR: 'R', CM: 'M' };
 
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Libreta').addItem('Configurar clave…', 'configurarClave').addItem('Rehacer hojas de los grupos', 'rehacerHojas').addToUi();
}
 
function rehacerHojas() {
  _filas = null;
  const ids = filas().filter(f => f.tipo === 'grupo').map(f => f.grupo);
  ids.forEach(hojaLegible);
  SpreadsheetApp.getActive().toast('Se rehicieron ' + ids.length + ' hojas de grupo.', 'Libreta');
}
 
function doGet() {
  return salida({ ok: true, data: 'Libreta de Clase: el servicio está activo (versión ' + VERSION + ').' });
}
 
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); }
  catch (err) { return salida({ ok: false, error: 'pedido', mensaje: 'Pedido inválido.' }); }
  const clave = claveActual();
  if (clave === 'CAMBIAR-ESTA-CLAVE') return salida({ ok: false, error: 'sin_clave', mensaje: 'El script no tiene clave. En la planilla usá el menú Libreta → Configurar clave (o cambiá CLAVE en el código, guardá y creá una nueva versión de la implementación).' });
  if (req.clave !== clave) return salida({ ok: false, error: 'clave', mensaje: 'La clave no coincide con la del script.' });
 
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
      return { planilla: SpreadsheetApp.getActive().getName(), version: VERSION };
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
 
  // Totales de faltas por estudiante, contadas por horas: fictas = horas A + horas J/2 + tardes/2
  const horasDef = Number(g.horasPorClase) > 0 ? Number(g.horasPorClase) : 1;
  const horas = cl => Number(cl.obj.horas) > 0 ? Number(cl.obj.horas) : horasDef;
  // horas que faltó en una clase: todas, salvo que se haya marcado menos (valores[sid][kid + '__h'])
  const horasFalta = (cl, sid, kid) => {
    const v = (cl.obj.valores || {})[sid] || {}, h = horas(cl), x = Number(v[kid + '__h']);
    return v[kid] !== 'A' && v[kid] !== 'J' ? 0 : x >= 1 && x < h ? x : h;
  };
  const kA = cols.find(k => k.tipo === 'asistencia');
  let filasTot = 0;
  if (kA) {
    const pct = Number(g.limiteFictas) > 0 ? Number(g.limiteFictas) : LIMITE_DEF;
    const base = clases.reduce((s, cl) => s + horas(cl), 0);
    const max = base * pct / 100;
    const cnt = est.map(e => {
      const o = { A: 0, J: 0, T: 0 };
      clases.forEach(cl => { const x = ((cl.obj.valores || {})[e.id] || {})[kA.id]; if (x === 'T') o.T++; else if (x === 'A' || x === 'J') o[x] += horasFalta(cl, e.id, kA.id); });
      o.F = o.A + o.J / 2 + o.T / 2;
      return o;
    });
    const tot = (etq, f, colorDe) => {
      const r = ['', '', etq], bg = [COLOR.cab, COLOR.cab, COLOR.cab];
      cnt.forEach(o => { r.push(f(o)); bg.push(colorDe ? colorDe(o) : null); });
      while (r.length < ancho) { r.push(''); bg.push(null); }
      vals.push(r); fondos.push(bg); filasTot++;
    };
    tot('Horas injust. (A)', o => o.A);
    tot('Horas just. (J)', o => o.J);
    tot('Tardes (T)', o => o.T);
    tot('Fictas (límite ' + Math.round(max * 10) / 10 + ')', o => o.F,
      o => !base || !o.F ? null : o.F > max ? COLOR.supera : o.F >= max * 0.8 ? COLOR.aviso : null);
  }
 
  clases.forEach(cl => {
    const c = cl.obj, v = c.valores || {};
    const [y, m, d] = cl.fecha.split('-');
    const ex = c.extra || [], it = cols.findIndex(k => k.tipo === 'texto'); // columnas solo de ese día (escrito, oral…), antes de Observación
    (it < 0 ? cols.concat(ex) : cols.slice(0, it).concat(ex, cols.slice(it))).forEach((k, i) => {
      const r = [i === 0 ? d + '/' + m + '/' + y + ' (' + horas(cl) + ' h)' : '', i === 0 ? (c.tema || '') : '', k.nombre];
      const bg = [null, null, null];
      est.forEach(e => {
        const x = (v[e.id] || {})[k.id];
        if (x === undefined || x === '') { r.push(''); bg.push(null); return; }
        if (k.tipo === 'nota') { const n = Number(x); r.push(n); bg.push(n >= NOTA_APRUEBA ? COLOR.ok : COLOR.ape); }
        else if (k.tipo === 'asistencia' || k.tipo === 'entrega' || k.tipo === 'conducta') {
          const hf = k.tipo === 'asistencia' ? horasFalta(cl, e.id, k.id) : 0;
          r.push(hf && hf < horas(cl) ? x + hf : (VER[x] || x));
          bg.push({ P: COLOR.ok, S: COLOR.ok, A: COLOR.falta, N: COLOR.falta, T: COLOR.tarde, M: COLOR.tarde, J: COLOR.just, CMB: COLOR.ok, CB: COLOR.ok, CR: COLOR.tarde, CM: COLOR.falta }[x] || null);
        } else { r.push(String(x)); bg.push(null); }
      });
      while (r.length < ancho) { r.push(''); bg.push(null); }
      vals.push(r); fondos.push(bg);
    });
  });
  fila([]);
  fila(['Referencias: P presente · A ausente · T tarde · J justificada (A2 / J2: faltó 2 horas de la clase) · ✓ hecho · ½ parcial · ✗ no hecho']);
  fila(['Faltas por horas. Fictas = horas A + horas J/2 + tardes/2. Límite: ' + (Number(g.limiteFictas) > 0 ? Number(g.limiteFictas) : LIMITE_DEF) + ' % de las horas dictadas. En ámbar, cerca del límite (80 %); en rojo, lo supera.']);
  fila(['Conducta: MB muy buena · B buena · R regular · M mala']);
 
  h.clear();
  h.getRange(1, 1, vals.length, ancho).setValues(vals).setBackgrounds(fondos);
  h.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  h.getRange(2, 1).setFontColor('#5d6880');
  h.getRange(3, 1, 1 + filasTot, ancho).setFontWeight('bold');
  h.getRange(4, 4, Math.max(vals.length - 3, 1), Math.max(ancho - 3, 1)).setHorizontalAlignment('center');
  h.setFrozenRows(3 + filasTot);
  h.setFrozenColumns(3);
  h.setColumnWidth(1, 90); h.setColumnWidth(2, 220); h.setColumnWidth(3, 110);
  if (ancho > 3) h.setColumnWidths(4, ancho - 3, 120);
  hojaResumen(gid, g, est, cols, clases);
}
 
/* ---------- hoja de resumen por grupo (una fila por estudiante) ---------- */
 
function claveCol(k) { return k.tipo + ':' + String(k.nombre || '').trim().toLowerCase(); }
 
function hojaResumen(gid, g, est, cols, clases) {
  const ss = SpreadsheetApp.getActive(), props = PropertiesService.getDocumentProperties();
  const idp = props.getProperty('res_' + gid);
  let h = idp ? ss.getSheets().find(s => String(s.getSheetId()) === idp) : null;
  const base = ('Resumen ' + String(g.nombre || 'Grupo')).replace(/[\[\]\*\?\/\\:]/g, ' ').trim().slice(0, 90);
  let nombre = base, i = 2;
  while (ss.getSheetByName(nombre) && ss.getSheetByName(nombre) !== h) nombre = base + ' (' + (i++) + ')';
  if (!h) { h = ss.insertSheet(nombre); props.setProperty('res_' + gid, String(h.getSheetId())); }
  else if (h.getName() !== nombre) h.setName(nombre);
 
  const horasDef = Number(g.horasPorClase) > 0 ? Number(g.horasPorClase) : 1;
  const horas = cl => Number(cl.obj.horas) > 0 ? Number(cl.obj.horas) : horasDef;
  const kA = cols.find(k => k.tipo === 'asistencia');
  const pct = Number(g.limiteFictas) > 0 ? Number(g.limiteFictas) : LIMITE_DEF;
  const totalHoras = clases.reduce((s, cl) => s + horas(cl), 0);
  const max = totalHoras * pct / 100;
 
  // categorías de notas: columnas de nota del grupo y de cada día, juntadas por nombre
  const cats = [], vistas = {};
  const addCat = k => { const key = claveCol(k); if (k.tipo !== 'nota' || vistas[key]) return; vistas[key] = true; cats.push({ key: key, nombre: k.nombre }); };
  cols.forEach(addCat);
  clases.forEach(cl => (cl.obj.extra || []).forEach(addCat));
  const pesos = g.pesos || {};
  const peso = c => pesos[c.key] === undefined || pesos[c.key] === '' ? 1 : Number(pesos[c.key]) || 0;
 
  const cab = ['Estudiante'];
  if (kA) cab.push('% asistencia', 'Horas injust. (A)', 'Horas just. (J)', 'Tardes (T)', 'Fictas', 'Límite', 'Faltas');
  cats.forEach(c => cab.push('Prom. ' + c.nombre));
  if (cats.length) cab.push(cats.length > 1 ? 'Prom. ponderado' : 'Promedio', 'Situación');
  const vals = [[g.nombre || 'Grupo'], ['Actualizado: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') + ' · ' + clases.length + ' clases, ' + totalHoras + ' horas dictadas'], cab];
  const fondos = [[null], [null], cab.map(() => COLOR.cab)];
 
  est.forEach(e => {
    const r = [e.nombre], bg = [null];
    if (kA) {
      let marc = 0, pres = 0; const o = { A: 0, J: 0, T: 0 };
      clases.forEach(cl => {
        const v = (cl.obj.valores || {})[e.id] || {}, x = v[kA.id];
        if (!x) return; marc++;
        if (x === 'P' || x === 'T') pres++;
        if (x === 'T') o.T++;
        else if (x === 'A' || x === 'J') { const hh = horas(cl), p = Number(v[kA.id + '__h']); o[x] += p >= 1 && p < hh ? p : hh; }
      });
      const F = o.A + o.J / 2 + o.T / 2;
      const nivel = !totalHoras || !F ? '' : F > max ? 'Supera el límite' : F >= max * 0.8 ? 'Cerca del límite' : '';
      r.push(marc ? pres / marc : '', o.A, o.J, o.T, F, Math.round(max * 10) / 10, nivel);
      const c = nivel === 'Supera el límite' ? COLOR.supera : nivel ? COLOR.aviso : null;
      bg.push(marc && pres / marc < 0.75 ? COLOR.falta : null, null, null, null, c, null, c);
    }
    let suma = 0, sp = 0;
    cats.forEach(c => {
      const ns = [];
      clases.forEach(cl => {
        const v = (cl.obj.valores || {})[e.id] || {};
        cols.concat(cl.obj.extra || []).forEach(k => { if (k.tipo === 'nota' && claveCol(k) === c.key && v[k.id] !== undefined && v[k.id] !== '') { const n = Number(v[k.id]); if (n >= 1 && n <= 10) ns.push(n); } });
      });
      const prom = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : '';
      r.push(prom === '' ? '' : Math.round(prom * 100) / 100); bg.push(prom === '' ? null : prom >= NOTA_APRUEBA ? COLOR.ok : COLOR.ape);
      if (prom !== '' && peso(c) > 0) { suma += prom * peso(c); sp += peso(c); }
    });
    if (cats.length) {
      const pg = sp ? suma / sp : '';
      r.push(pg === '' ? '' : Math.round(pg * 100) / 100, pg === '' ? '' : pg >= NOTA_APRUEBA ? 'Aprobado' : 'APE');
      const c = pg === '' ? null : pg >= NOTA_APRUEBA ? COLOR.ok : COLOR.ape; bg.push(c, c);
    }
    vals.push(r); fondos.push(bg);
  });
 
  const ancho = cab.length;
  vals.push([]); fondos.push([]);
  vals.push(['Fictas = horas A + horas J/2 + tardes/2. Límite: ' + pct + ' % de las horas dictadas. En ámbar, cerca del límite (80 %); en rojo, lo supera.']);
  if (cats.length > 1) vals.push(['Ponderación: ' + cats.map(c => c.nombre + ' ' + peso(c)).join(' · ') + ' (las categorías sin notas no cuentan).']);
  vals.forEach(r => { while (r.length < ancho) r.push(''); });
  while (fondos.length < vals.length) fondos.push([]);
  fondos.forEach(r => { while (r.length < ancho) r.push(null); });
 
  h.clear();
  h.getRange(1, 1, vals.length, ancho).setValues(vals).setBackgrounds(fondos);
  h.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  h.getRange(2, 1).setFontColor('#5d6880');
  h.getRange(3, 1, 1, ancho).setFontWeight('bold').setWrap(true);
  if (est.length && ancho > 1) h.getRange(4, 2, est.length, ancho - 1).setHorizontalAlignment('center');
  if (kA && est.length) h.getRange(4, 2, est.length, 1).setNumberFormat('0%');
  h.setFrozenRows(3); h.setFrozenColumns(1);
  h.setColumnWidth(1, 200); if (ancho > 1) h.setColumnWidths(2, ancho - 1, 110);
}
 
function borrarHojaLegible(gid) {
  const h = buscarHoja(gid), ss = SpreadsheetApp.getActive(), props = PropertiesService.getDocumentProperties();
  if (h) ss.deleteSheet(h);
  props.deleteProperty(propHoja(gid));
  const idr = props.getProperty('res_' + gid), hr = idr ? ss.getSheets().find(s => String(s.getSheetId()) === idr) : null;
  if (hr) ss.deleteSheet(hr);
  props.deleteProperty('res_' + gid);
}
 
function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

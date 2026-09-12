// ---------- GOOGLE LOGIN LOGIC ----------
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjrlbKWLiBAfyc3NPw0biSCu3D45611EGGbZ2CIXI36r1l5--6JaklvIj8rBJmIZ31/exec';

function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  if(data.email.endsWith('@esan.edu.pe') || data.email.endsWith('@ue.edu.pe')) {
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    
    // Mostramos la pantalla de carga en lugar de la app
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
    
    document.getElementById('nombre').value = data.name;
    document.getElementById('correo').value = data.email;
    cargarVacantes(); 
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

// ---------- FORM LOGIC ----------
let PROJECTS = []; 
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

// Añadimos 'tipo' al estado global
let state = { tipo: null, project: null, role: null, days: [] };

const lineupEl = document.getElementById('lineup');
const rolesPermEl = document.getElementById('rolesPermanentes');
const rolesEvtEl = document.getElementById('rolesEvento');
const dayChipsEl = document.getElementById('dayChips');

async function cargarVacantes() {
  try {
    const res = await fetch(SCRIPT_URL);
    PROJECTS = JSON.parse(await res.text()); 
    updateUI();
    
    // Ocultamos la carga y revelamos la aplicación
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
  } catch(e) {
    console.error("Error:", e);
  }
}

// Control maestro de visualización
function updateUI() {
  renderRoles();
  
  const secProyecto = document.getElementById('sec-proyecto');
  const secDispo = document.getElementById('sec-disponibilidad');

  if (state.tipo === 'Permanente') {
    secProyecto.style.display = 'none';
    secDispo.style.display = 'block';
  } else if (state.tipo === 'Evento') {
    secProyecto.style.display = 'block';
    secDispo.style.display = 'none';
    renderLineup(); 
  } else {
    secProyecto.style.display = 'none';
    secDispo.style.display = 'none';
  }
  
  updateSummary();
}

function renderRoles() {
  rolesPermEl.innerHTML = '';
  rolesEvtEl.innerHTML = '';

  const pPerm = PROJECTS.filter(p => p.tipo.toLowerCase() === 'permanente');
  const pEvt = PROJECTS.filter(p => p.tipo.toLowerCase() !== 'permanente');

  const rolesPerm = [...new Set(pPerm.flatMap(p => p.roles))];
  const rolesEvt = [...new Set(pEvt.flatMap(p => p.roles))];

  document.getElementById('permEmpty').style.display = rolesPerm.length ? 'none' : 'block';
  document.getElementById('evtEmpty').style.display = rolesEvt.length ? 'none' : 'block';

  rolesPerm.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (state.role === r && state.tipo === 'Permanente' ? ' active' : '');
    btn.textContent = r;
    btn.addEventListener('click', () => {
      state.tipo = 'Permanente';
      state.role = r;
      // Asignamos directamente el proyecto permanente asociado al rol
      const proj = pPerm.find(x => x.roles.includes(r));
      state.project = proj ? proj.id : null;
      updateUI();
    });
    rolesPermEl.appendChild(btn);
  });

  rolesEvt.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (state.role === r && state.tipo === 'Evento' ? ' active' : '');
    btn.textContent = r;
    btn.addEventListener('click', () => {
      // Si cambia de rol, reseteamos el proyecto seleccionado
      if (state.role !== r) state.project = null; 
      state.tipo = 'Evento';
      state.role = r;
      updateUI();
    });
    rolesEvtEl.appendChild(btn);
  });
}

function renderLineup(){
  lineupEl.innerHTML = '';
  // Filtramos solo los eventos que soliciten el rol seleccionado
  const eventosFiltrados = PROJECTS.filter(p => p.tipo.toLowerCase() !== 'permanente' && p.roles.includes(state.role));
  
  if(eventosFiltrados.length === 0){
    lineupEl.innerHTML = '<p class="empty-note">No hay eventos activos para esta función en este momento.</p>';
    return;
  }

  eventosFiltrados.forEach(p => {
    const div = document.createElement('div');
    const agotado = (typeof p.vac === 'number' ? p.vac : parseInt(p.vac)) <= 0; 

    div.className = 'channel' + (state.project === p.id ? ' active' : '');
    if (agotado) {
      div.style.opacity = '0.4';
      div.style.pointerEvents = 'none'; 
      div.style.filter = 'grayscale(1)';
    }

    div.innerHTML = `
      <span class="ch-code">${p.code}</span>
      <div class="ch-body">
        <p class="ch-title">${p.title}</p>
        <p class="ch-sub">${p.sub}</p>
        <p class="ch-sub" style="color:var(--gold); font-size:11px; margin-top:4px;">Fecha del evento: ${p.fechaLimite}</p>
      </div>
      <span class="ch-vac" style="${agotado ? 'color:var(--on-air); font-weight:bold;' : ''}">
        ${agotado ? 'AGOTADO' : p.vac + ' vacantes'}
      </span>
    `;
    
    if (!agotado) {
      div.addEventListener('click', () => {
        state.project = p.id;
        renderLineup();
        updateSummary();
      });
    }
    lineupEl.appendChild(div);
  });
}

function renderDays(){
  dayChipsEl.innerHTML = '';
  DAYS.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'chip day' + (state.days.includes(d) ? ' active' : '');
    btn.textContent = d;
    btn.addEventListener('click', () => {
      if(state.days.includes(d)) state.days = state.days.filter(x=>x!==d);
      else state.days.push(d);
      renderDays();
      updateSummary();
    });
    dayChipsEl.appendChild(btn);
  });
}

const nombreEl = document.getElementById('nombre');
const carreraEl = document.getElementById('carrera');
const codigoEl = document.getElementById('codigo');
const turnoEl = document.getElementById('turno');
[carreraEl, codigoEl, turnoEl].forEach(el => el.addEventListener('input', updateSummary));

function getDispoStr() {
  const p = PROJECTS.find(x => x.id === state.project);

  // Si es evento, usamos la fecha del evento seleccionado
  if (state.tipo === 'Evento') {
    return p && p.fechaLimite ? `Día del evento: ${p.fechaLimite}` : 'Selecciona un evento';
  }

  // Si es permanente, mantiene la lógica de días y turnos
  const turnoVal = turnoEl.value.trim();
  const dispo = [];
  if(state.days.length) dispo.push(state.days.join(', '));
  if(turnoVal) dispo.push(turnoVal);
  return dispo.join(' — ');
}

function updateSummary(){
  const p = PROJECTS.find(x => x.id === state.project);
  const nombre = nombreEl.value.trim();
  const dispoStr = getDispoStr();

  // Actualiza la placa en vivo
  document.getElementById('ltName').textContent = nombre ? nombre.toUpperCase() : 'TU NOMBRE APARECERÁ AQUÍ';
  
  if (state.tipo === 'Permanente' && p && state.role) {
    document.getElementById('ltRole').textContent = `${state.role.toUpperCase()} (PERMANENTE)`;
  } else if (state.tipo === 'Evento' && p && state.role) {
    document.getElementById('ltRole').textContent = `${state.role.toUpperCase()} · ${p.title.toUpperCase()}`;
  } else {
    document.getElementById('ltRole').textContent = 'SELECCIONA UNA MODALIDAD Y FUNCIÓN';
  }

  // Texto resumen
  const lines = [
    `Nombre: ${nombre || '—'}`,
    `Carrera: ${carreraEl.value.trim() || '—'}`,
    `Código: ${codigoEl.value.trim() || '—'}`,
    `Proyecto: ${p ? p.title : '—'}`,
    `Función: ${state.role || '—'}`,
    `Disponibilidad: ${dispoStr || '—'}`
  ];
  if (state.tipo === 'Permanente' && p) {
    lines.push(`Cierre de inscripción: ${p.fechaLimite}`);
  }
  document.getElementById('summaryText').textContent = lines.join('\n');

  // Lógica de validación para habilitar el botón
  const carreraValida = carreraEl.value.trim() !== '';
  const codigoValido = codigoEl.value.trim() !== '';
  
  let complete = nombre && carreraValida && codigoValido && state.role && p;
  
  if (state.tipo === 'Permanente') {
    complete = complete && (state.days.length > 0 || turnoEl.value.trim() !== '');
  }
  document.getElementById('submitBtn').disabled = !complete;
}

// ---------- SUBMIT LOGIC TO GOOGLE SHEETS ----------
document.getElementById('submitBtn').addEventListener('click', async () => {
  const p = PROJECTS.find(x => x.id === state.project);
  const btn = document.getElementById('submitBtn');
  
  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    carrera: document.getElementById('carrera').value.trim(),
    codigo: document.getElementById('codigo').value.trim(),
    proyecto: p.title,
    funcion: state.role,
    disponibilidad: getDispoStr()
  };

  btn.textContent = 'Enviando...';
  btn.disabled = true;

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    
    // Leemos la respuesta de Apps Script
    const result = await response.json();
    
    if (result.status === 'error') {
      // Muestra el mensaje: "Ya estás registrado" o "Intenta en 5 segundos"
      showToast(result.message);
      btn.textContent = 'Enviar Postulación';
      btn.disabled = false;
      return; // Detiene la ejecución aquí
    }
    
    // Si el status es "success"
    showToast('¡Postulación enviada con éxito!');
    
    state.project = null; 
    document.getElementById('turno').value = ''; 
    
    await cargarVacantes(); 
    
    btn.textContent = 'Enviar Postulación'; 
  } catch(e) {
    showToast('Hubo un error de conexión. Por favor intenta de nuevo.');
    btn.textContent = 'Enviar Postulación';
    btn.disabled = false;
  }
});

// ---------- LÓGICA DE CERRAR SESIÓN ----------
document.getElementById('logoutBtn').addEventListener('click', () => {
  // Desactiva la auto-selección de cuenta de Google
  google.accounts.id.disableAutoSelect();
  
  // Limpia los datos del formulario
  document.getElementById('carrera').value = '';
  document.getElementById('codigo').value = '';
  document.getElementById('turno').value = '';
  
  // Resetea el estado
  state = { tipo: null, project: null, role: null, days: [] };
  
  // Devuelve a la pantalla de login
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex'; // o 'block' según tu CSS original
});

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  setTimeout(() => { if(t.textContent === msg) t.textContent = ''; }, 4000);
}

renderDays();

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
    
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
  } catch(e) {
    console.error("Error al cargar vacantes:", e);
    // Recuperación ante error de conexión para evitar pantalla colgada
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    alert('Error al conectar con la base de datos. Por favor intenta iniciar sesión de nuevo.');
  }
}

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

// ---------- RENDER DE ROLES CON CONTADOR DE CUPOS ----------
function renderRoles() {
  rolesPermEl.innerHTML = '';
  rolesEvtEl.innerHTML = '';

  const pPerm = PROJECTS.filter(p => p.tipo.toLowerCase() === 'permanente');
  const pEvt = PROJECTS.filter(p => p.tipo.toLowerCase() !== 'permanente');

  // Obtener nombres únicos de roles para cada modalidad
  const rolesPermNombres = [...new Set(pPerm.flatMap(p => p.roles.map(r => r.nombre)))];
  const rolesEvtNombres = [...new Set(pEvt.flatMap(p => p.roles.map(r => r.nombre)))];

  document.getElementById('permEmpty').style.display = rolesPermNombres.length ? 'none' : 'block';
  document.getElementById('evtEmpty').style.display = rolesEvtNombres.length ? 'none' : 'block';

  // Render para MÉRITOS PERMANENTES
  rolesPermNombres.forEach(nombreRol => {
    let dispTotal = 0;
    pPerm.forEach(p => {
      const rObj = p.roles.find(r => r.nombre === nombreRol);
      if (rObj) dispTotal += rObj.disponibles;
    });

    const btn = document.createElement('button');
    const agotado = dispTotal <= 0;
    btn.className = 'chip' + (state.role === nombreRol && state.tipo === 'Permanente' ? ' active' : '');
    btn.textContent = `${nombreRol}: ${agotado ? 'AGOTADO' : dispTotal}`;
    
    if (agotado) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.addEventListener('click', () => {
        state.tipo = 'Permanente';
        state.role = nombreRol;
        const proj = pPerm.find(x => x.roles.some(r => r.nombre === nombreRol));
        state.project = proj ? proj.id : null;
        updateUI();
        
        setTimeout(() => {
          document.getElementById('sec-disponibilidad')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    }
    rolesPermEl.appendChild(btn);
  });

  // Render para MÉRITOS POR EVENTO
  rolesEvtNombres.forEach(nombreRol => {
    let dispTotal = 0;
    pEvt.forEach(p => {
      const rObj = p.roles.find(r => r.nombre === nombreRol);
      if (rObj) dispTotal += rObj.disponibles;
    });

    const btn = document.createElement('button');
    const agotado = dispTotal <= 0;
    btn.className = 'chip' + (state.role === nombreRol && state.tipo === 'Evento' ? ' active' : '');
    btn.textContent = `${nombreRol}: ${agotado ? 'AGOTADO' : dispTotal}`;
    
    if (agotado) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.addEventListener('click', () => {
        if (state.role !== nombreRol) state.project = null; 
        state.tipo = 'Evento';
        state.role = nombreRol;
        updateUI();

        setTimeout(() => {
          document.getElementById('sec-proyecto')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    }
    rolesEvtEl.appendChild(btn);
  });
}

// ---------- RENDER DE LINEUP CON VACANTES POR ROL SELECCIONADO ----------
function renderLineup(){
  lineupEl.innerHTML = '';
  const eventosFiltrados = PROJECTS.filter(p => 
    p.tipo.toLowerCase() !== 'permanente' && 
    p.roles.some(r => r.nombre === state.role)
  );
  
  if(eventosFiltrados.length === 0){
    lineupEl.innerHTML = '<p class="empty-note">No hay eventos activos para esta función en este momento.</p>';
    return;
  }

  eventosFiltrados.forEach(p => {
    const rolInfo = p.roles.find(r => r.nombre === state.role);
    const vacantesRol = rolInfo ? rolInfo.disponibles : 0;
    const agotado = vacantesRol <= 0; 

    const div = document.createElement('div');
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
        ${agotado ? 'AGOTADO' : vacantesRol + ' cupos para ' + state.role}
      </span>
    `;
    
    if (!agotado) {
      div.addEventListener('click', () => {
        state.project = p.id;
        renderLineup();
        updateSummary();

        setTimeout(() => {
          document.getElementById('sec-datos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
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

  if (state.tipo === 'Evento') {
    return p && p.fechaLimite ? `Día del evento: ${p.fechaLimite}` : 'Selecciona un evento';
  }

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
  const btn = document.getElementById('submitBtn');

  document.getElementById('ltName').textContent = nombre ? nombre.toUpperCase() : 'TU NOMBRE APARECERÁ AQUÍ';
  
  if (state.tipo === 'Permanente' && p && state.role) {
    document.getElementById('ltRole').textContent = `${state.role.toUpperCase()} (PERMANENTE)`;
  } else if (state.tipo === 'Evento' && p && state.role) {
    document.getElementById('ltRole').textContent = `${state.role.toUpperCase()} · ${p.title.toUpperCase()}`;
  } else {
    document.getElementById('ltRole').textContent = 'SELECCIONA UNA MODALIDAD Y FUNCIÓN';
  }

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

  const carreraValida = carreraEl.value.trim() !== '';
  const codigoValido = codigoEl.value.trim() !== '';
  const dispoValida = state.tipo === 'Evento' || (state.days.length > 0 || turnoEl.value.trim() !== '');

  let faltante = '';
  if (!state.role) {
    faltante = 'Elige una función';
  } else if (state.tipo === 'Evento' && !p) {
    faltante = 'Selecciona un evento';
  } else if (state.tipo === 'Permanente' && !dispoValida) {
    faltante = 'Indica tus días/turno';
  } else if (!carreraValida) {
    faltante = 'Ingresa tu carrera';
  } else if (!codigoValido) {
    faltante = 'Ingresa tu código';
  }

  if (faltante !== '') {
    btn.disabled = true;
    btn.textContent = `Falta: ${faltante}`;
  } else {
    btn.disabled = false;
    btn.textContent = 'Enviar Postulación';
  }
}

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
    
    const result = await response.json();
    
    if (result.status === 'error') {
      showToast(result.message);
      updateSummary();
      return;
    }
    
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    showToast('¡Postulación enviada con éxito!');
    
    state.project = null; 
    document.getElementById('turno').value = ''; 
    
    await cargarVacantes(); 
  } catch(e) {
    showToast('Hubo un error de conexión. Por favor intenta de nuevo.');
    updateSummary();
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  
  document.getElementById('carrera').value = '';
  document.getElementById('codigo').value = '';
  document.getElementById('turno').value = '';
  
  state = { tipo: null, project: null, role: null, days: [] };
  
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
});

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  setTimeout(() => { if(t.textContent === msg) t.textContent = ''; }, 4000);
}

renderDays();

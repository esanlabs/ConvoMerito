// ---------- GOOGLE LOGIN LOGIC ----------
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjrlbKWLiBAfyc3NPw0biSCu3D45611EGGbZ2CIXI36r1l5--6JaklvIj8rBJmIZ31/exec'; // Tu URL actual

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
    document.getElementById('app-content').style.display = 'block';
    
    document.getElementById('nombre').value = data.name;
    document.getElementById('correo').value = data.email;
    
    // Pedimos a Google Sheets toda la info (Proyectos, vacantes, roles y fechas)
    cargarVacantes(); 
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

// ---------- FORM LOGIC ----------
// Ya no usamos una lista estática, empieza vacía y se llena sola desde el Excel
let PROJECTS = []; 
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

let state = { project:null, role:null, days:[] };

const lineupEl = document.getElementById('lineup');
const roleChipsEl = document.getElementById('roleChips');
const roleEmptyEl = document.getElementById('roleEmpty');
const dayChipsEl = document.getElementById('dayChips');

async function cargarVacantes() {
  try {
    console.log("Solicitando datos a Google Sheets...");
    const res = await fetch(SCRIPT_URL);
    const textoCrudo = await res.text(); 
    
    // El Excel nos envía el paquete completo, lo guardamos en PROJECTS
    PROJECTS = JSON.parse(textoCrudo); 
    
    // Si no hay proyectos activos en esta fecha, mostramos un mensaje
    if(PROJECTS.length === 0) {
      lineupEl.innerHTML = '<p style="color:var(--slate); font-size:14px;">No hay convocatorias activas en este momento.</p>';
      return;
    }
    
    renderLineup(); 
  } catch(e) {
    console.error("Error al cargar vacantes. Detalles:", e);
  }
}

function renderLineup(){
  lineupEl.innerHTML = '';
  PROJECTS.forEach(p=>{
    const div = document.createElement('div');
    const agotado = (typeof p.vac === 'number' ? p.vac : parseInt(p.vac)) <= 0; 

    div.className = 'channel' + (state.project===p.id ? ' active' : '');
    if (agotado) {
      div.style.opacity = '0.4';
      div.style.pointerEvents = 'none'; 
      div.style.filter = 'grayscale(1)';
    }

    // Hemos añadido una línea extra para mostrar la fecha límite visualmente
    div.innerHTML = `
      <span class="ch-code">${p.code}</span>
      <div class="ch-body">
        <p class="ch-title">${p.title}</p>
        <p class="ch-sub">${p.sub}</p>
        ${p.fechaLimite ? `<p class="ch-sub" style="color:var(--gold); font-size:11px; margin-top:4px;">Cierra: ${p.fechaLimite}</p>` : ''}
      </div>
      <span class="ch-vac" style="${agotado ? 'color:var(--on-air); font-weight:bold;' : ''}">
        ${agotado ? 'AGOTADO' : p.vac + ' vacantes'}
      </span>
    `;
    
    if (!agotado) {
      div.addEventListener('click', ()=>{
        state.project = p.id;
        state.role = null;
        renderLineup();
        renderRoles();
        update();
      });
    }
    lineupEl.appendChild(div);
  });
}

function renderRoles(){
  roleChipsEl.innerHTML = '';
  const p = PROJECTS.find(x=>x.id===state.project);
  if(!p){ roleEmptyEl.style.display='block'; return; }
  roleEmptyEl.style.display='none';
  
  if(p.roles && p.roles.length > 0) {
    p.roles.forEach(r=>{
      const btn = document.createElement('button');
      btn.className = 'chip' + (state.role===r ? ' active' : '');
      btn.textContent = r;
      btn.addEventListener('click', ()=>{ state.role = r; renderRoles(); update(); });
      roleChipsEl.appendChild(btn);
    });
  } else {
    roleEmptyEl.textContent = 'No hay funciones específicas configuradas.';
    roleEmptyEl.style.display='block';
  }
}

function renderDays(){
  dayChipsEl.innerHTML = '';
  DAYS.forEach(d=>{
    const btn = document.createElement('button');
    btn.className = 'chip day' + (state.days.includes(d) ? ' active' : '');
    btn.textContent = d;
    btn.addEventListener('click', ()=>{
      if(state.days.includes(d)) state.days = state.days.filter(x=>x!==d);
      else state.days.push(d);
      renderDays();
      update();
    });
    dayChipsEl.appendChild(btn);
  });
}

const nombreEl = document.getElementById('nombre');
const carreraEl = document.getElementById('carrera');
const codigoEl = document.getElementById('codigo');
const turnoEl = document.getElementById('turno');
[carreraEl, codigoEl, turnoEl].forEach(el=> el.addEventListener('input', update));

function getDispoStr() {
  const turnoVal = turnoEl.value.trim();
  const dispo = [];
  if(state.days.length) dispo.push(state.days.join(', '));
  if(turnoVal) dispo.push(turnoVal);
  return dispo.join(' — ');
}

function update(){
  const p = PROJECTS.find(x=>x.id===state.project);
  const nombre = nombreEl.value.trim();
  const dispoStr = getDispoStr();

  document.getElementById('ltName').textContent = nombre ? nombre.toUpperCase() : 'TU NOMBRE APARECERÁ AQUÍ';
  document.getElementById('ltRole').textContent = (p && state.role) ? `${state.role.toUpperCase()} · ${p.title.toUpperCase()}` : 'SELECCIONA UN PROYECTO Y UNA FUNCIÓN';

  const lines = [
    `Nombre: ${nombre || '—'}`,
    `Carrera: ${carreraEl.value.trim() || '—'}`,
    `Código: ${codigoEl.value.trim() || '—'}`,
    `Proyecto: ${p ? p.title : '—'}`,
    `Función: ${state.role || '—'}`,
    `Disponibilidad: ${dispoStr || '—'}`
  ];
  document.getElementById('summaryText').textContent = lines.join('\n');

  const complete = nombre && carreraEl.value.trim() && codigoEl.value.trim() && p && state.role && dispoStr;
  document.getElementById('submitBtn').disabled = !complete;
}

// ---------- SUBMIT LOGIC TO GOOGLE SHEETS ----------
document.getElementById('submitBtn').addEventListener('click', async ()=>{
  const p = PROJECTS.find(x=>x.id===state.project);
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
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    
    showToast('¡Postulación enviada a la base de datos con éxito!');
    btn.textContent = 'Enviado ✓';
  } catch(e) {
    showToast('Hubo un error al enviar. Por favor intenta de nuevo.');
    btn.textContent = 'Enviar Postulación';
    btn.disabled = false;
  }
});

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  setTimeout(()=>{ if(t.textContent===msg) t.textContent=''; }, 4000);
}

// Renderizamos la UI base mientras se fuerza el login (que luego cargará los proyectos)
renderLineup();
renderRoles();
renderDays();
update();

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjrlbKWLiBAfyc3NPw0biSCu3D45611EGGbZ2CIXI36r1l5--6JaklvIj8rBJmIZ31/exec';
let rawRegistros = [];
let rawConfig = [];
let calendar;
let loggedAdminEmail = "";

// 1. LÓGICA DE LOGIN (Igual que en main.js)
function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join('')));
}

async function handleCredentialResponse(response) {
  const data = parseJwt(response.credential);
  loggedAdminEmail = data.email;
  
  // Solicitamos los datos validando el correo
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_dashboard', email: loggedAdminEmail })
    });
    const json = await res.json();
    
    if (json.status === 'success') {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-content').style.display = 'block';
      rawRegistros = json.registros;
      rawConfig = json.configuracion;
      inicializarCalendario();
    } else {
      document.getElementById('login-error').style.display = 'block';
    }
  } catch (error) {
    alert("Error de conexión con el servidor.");
  }
}

// 2. PARSEO DE DATOS Y CONSTRUCCIÓN DEL CALENDARIO
function procesarEventos(filtro = "Todos") {
  const eventosCalendario = [];
  
  // rawRegistros[0] = Cabeceras (Nombre, Carrera, Codigo, Proyecto, Funcion, Disponibilidad)
  // rawConfig[0] = Cabeceras (Evento, Vacantes, Descripcion, Roles, FechaLimite, Tipo)
  
  for (let i = 1; i < rawRegistros.length; i++) {
    const [nombre, carrera, codigo, proyecto, funcion, disponibilidad] = rawRegistros[i];
    
    // Buscar configuración del proyecto para saber fecha y tipo
    const configRow = rawConfig.find(row => row[0] === proyecto);
    if (!configRow) continue;
    
    const [evento, vacantes, desc, roles, fecha, tipo] = configRow;
    const esPermanente = tipo === 'Permanente';
    
    if (filtro !== "Todos" && tipo !== filtro) continue;

    if (esPermanente) {
      // Si es permanente, la disponibilidad tiene días (ej. "Lunes, Miércoles - 9:00 a.m...")
      const diasMapa = { 'Domingo':0, 'Lunes':1, 'Martes':2, 'Miércoles':3, 'Jueves':4, 'Viernes':5, 'Sábado':6 };
      let diasAsignados = [];
      Object.keys(diasMapa).forEach(d => {
        if (disponibilidad.includes(d)) diasAsignados.push(diasMapa[d]);
      });

      if (diasAsignados.length > 0) {
        eventosCalendario.push({
          title: `${nombre} (${funcion})`,
          daysOfWeek: diasAsignados, 
          startRecur: new Date(), // Comienza desde hoy
          extendedProps: { proyecto, funcion, disponibilidad, tipo }
        });
      }
    } else {
      // Es un evento puntual, usamos la fecha límite
      let dateObj = new Date(fecha);
      if (isNaN(dateObj)) {
        // Parsear DD/MM/YYYY si viene en string
        const parts = String(fecha).split('/');
        if(parts.length === 3) dateObj = new Date(parts[2], parts[1]-1, parts[0]);
      }
      
      if (!isNaN(dateObj)) {
        eventosCalendario.push({
          title: `${nombre} (${funcion}) - ${proyecto}`,
          start: dateObj.toISOString().split('T')[0],
          backgroundColor: '#f59e0b',
          borderColor: '#f59e0b',
          textColor: '#000',
          extendedProps: { proyecto, funcion, disponibilidad, tipo }
        });
      }
    }
  }
  return eventosCalendario;
}

function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
    },
    events: procesarEventos(),
    eventClick: function(info) {
      const p = info.event.extendedProps;
      alert(`Alumno: ${info.event.title.split(' (')[0]}\nFunción: ${p.funcion}\nProyecto: ${p.proyecto}\nDisponibilidad: ${p.disponibilidad}`);
    }
  });
  calendar.render();
}

// 3. FILTROS
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    const filtro = e.target.getAttribute('data-filter');
    calendar.removeAllEvents();
    calendar.addEventSource(procesarEventos(filtro));
  });
});

// 4. EXPORTACIÓN A EXCEL
document.getElementById('exportExcelBtn').addEventListener('click', () => {
  // Convertimos rawRegistros (arrays) a hoja de Excel
  const ws = XLSX.utils.aoa_to_sheet(rawRegistros);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Postulantes");
  XLSX.writeFile(wb, "Reporte_Meritos_ESAN.xlsx");
});

// 5. EXPORTACIÓN A PDF
document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const element = document.getElementById('calendar-container');
  const opt = {
    margin:       10,
    filename:     'Calendario_Meritos_ESAN.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };
  html2pdf().set(opt).from(element).save();
});

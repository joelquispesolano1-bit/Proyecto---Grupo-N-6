// ================== CONSTANTES Y VARIABLES ==================
const API_BASE_URL = 'http://localhost:5000';
let usuarioActual = null;
let perfilUsuario = null;

const elements = {
  habitList: document.getElementById("habitList"),
  activityList: document.getElementById("activityList"),
  addHabitBtn: document.getElementById("addHabitBtn"),
  habitName: document.getElementById("habitName"),
  habitTime: document.getElementById("habitTime"),
  clock: document.getElementById("clock"),
  manualClock: document.getElementById("manualClock"),
  setClockBtn: document.getElementById("setClockBtn"),
  formatSelect: document.getElementById("formatSelect"),
  filterSelect: document.getElementById("filterSelect"),
  alarmSound: document.getElementById("alarmSound"),
  modal: document.getElementById("modal"),
  modalMessage: document.getElementById("modalMessage"),
  modalButtons: document.getElementById("modalButtons"),
  profileDetails: document.getElementById("profileDetails"),
  syncHabitsBtn: document.getElementById("syncHabitsBtn"),
  userName: document.getElementById("userName"),
  activityCounters: document.getElementById("activityCounters")
};

let habits = [];
let activities = [];
let currentHabit = null;
let manualTime = null;
let usingManualClock = false;
let alarmTimeout = null;

// ================== INICIALIZACIÓN ==================
function initializeApp() {
  verificarSesion();
  loadSettings();
  setupEventListeners();
  startClock();
  cargarPerfilUsuario();
}

function verificarSesion() {
  const urlParams = new URLSearchParams(window.location.search);
  const usuarioId = urlParams.get('usuario_id');

  if (!usuarioId) {
    window.location.href = '/';
    return;
  }

  usuarioActual = { id: usuarioId };
  cargarDatosUsuario();
}

async function cargarDatosUsuario() {
  try {
    const respuesta = await fetch(`${API_BASE_URL}/perfiles/${usuarioActual.id}`);
    if (respuesta.ok) {
      const usuario = await respuesta.json();
      elements.userName.textContent = usuario.nombre || 'Usuario';
    }
  } catch (error) {
    console.error('Error cargando datos usuario:', error);
  }
}

async function cargarPerfilUsuario() {
  if (!usuarioActual) return;
  
  try {
    const respuesta = await fetch(`${API_BASE_URL}/perfiles/${usuarioActual.id}`);
    if (respuesta.ok) {
      perfilUsuario = await respuesta.json();
      
      if (perfilUsuario) {
        mostrarInformacionPerfil();
        await cargarHabitosProgramados();
        await cargarHistorialDesdeMySQL();
      }
    }
  } catch (error) {
    console.error('Error cargando perfil:', error);
  }
}

// ✅ Cargar hábitos desde MySQL
async function cargarHabitosProgramados() {
  if (!usuarioActual) return;

  try {
    console.log('Cargando hábitos desde:', `${API_BASE_URL}/habitos/obtener/${usuarioActual.id}`);
    const respuesta = await fetch(`${API_BASE_URL}/habitos/obtener/${usuarioActual.id}`);
    console.log('Respuesta de hábitos:', respuesta.status, respuesta.statusText);

    if (respuesta.ok) {
      const datos = await respuesta.json();
      console.log('Datos de hábitos recibidos:', datos);

      // Mapear los campos del backend al formato esperado por el frontend
      habits = (datos.habitos || []).map(habito => ({
        id: habito.id.toString(),
        name: habito.nombre,
        time: habito.hora,
        repeat: habito.activo === 1 || habito.activo === true,
        activo: habito.activo === 1 || habito.activo === true // ✅ Agregar campo 'activo'
      }));

      console.log('Hábitos mapeados:', habits);
      renderHabits();
    } else {
      console.error('Error en respuesta de hábitos:', respuesta.status, await respuesta.text());
    }
  } catch (error) {
    console.error('Error cargando hábitos:', error);
  }
}

// ✅ Cargar historial desde MySQL
async function cargarHistorialDesdeMySQL() {
  if (!usuarioActual) return;

  try {
    console.log('Cargando historial desde:', `${API_BASE_URL}/historial/obtener/${usuarioActual.id}`);
    const respuesta = await fetch(`${API_BASE_URL}/historial/obtener/${usuarioActual.id}`);
    console.log('Respuesta de historial:', respuesta.status, respuesta.statusText);

    if (respuesta.ok) {
      const datos = await respuesta.json();
      console.log('Datos de historial recibidos:', datos);

      // Mapear los campos del backend al formato esperado por el frontend
      activities = (datos.historial || []).map(actividad => ({
        habitId: actividad.id.toString(),
        name: actividad.nombre,
        time: actividad.hora,
        status: actividad.estado === 'completado' ? '✅ Cumplido' : '❌ No cumplido',
        statusClass: actividad.estado === 'completado' ? 'done' : 'fail',
        date: new Date(actividad.fecha).toLocaleDateString('es-ES')
      }));

      console.log('Historial mapeado:', activities);
      renderActivities();
    } else {
      console.error('Error en respuesta de historial:', respuesta.status, await respuesta.text());
    }
  } catch (error) {
    console.error('Error cargando historial:', error);
  }
}

function mostrarInformacionPerfil() {
  if (!perfilUsuario) return;
  
  elements.profileDetails.innerHTML = `
    <p><strong>👤 Nombre:</strong> ${perfilUsuario.nombre}</p>
    <p><strong>📧 Email:</strong> ${perfilUsuario.email}</p>
    <p><strong>📅 Miembro desde:</strong> ${new Date(perfilUsuario.fecha_creacion).toLocaleDateString('es-ES')}</p>
    <p><strong>📊 Hábitos programados:</strong> ${habits.length}</p>
    <p><strong>📈 Historial de hábitos:</strong> ${activities.length}</p>
  `;
}

// ================== CONFIGURACIÓN ==================
function loadSettings() {
  let timeFormat = "24";
  elements.formatSelect.value = timeFormat;
  
  let activityFilter = "all";
  elements.filterSelect.value = activityFilter;
}

function setupEventListeners() {
  elements.formatSelect.addEventListener("change", () => {
    // No guardar en localStorage
  });
  
  elements.filterSelect.addEventListener("change", () => {
    renderActivities();
  });
  
  elements.addHabitBtn.addEventListener("click", addHabit);
  elements.setClockBtn.addEventListener("click", setManualTime);
  
  document.addEventListener("click", initializeAudio, { once: true });
}

// ================== RELOJ ==================
function startClock() {
  setInterval(updateClock, 1000);
}

function updateClock() {
  let now;
  if (usingManualClock && manualTime) {
    manualTime.setSeconds(manualTime.getSeconds() + 1);
    now = manualTime;
  } else {
    now = new Date();
  }

  const displayOptions = { 
    hour: "2-digit", 
    minute: "2-digit", 
    second: "2-digit",
    hour12: (elements.formatSelect.value === "12")
  };
  
  elements.clock.textContent = now.toLocaleTimeString("es-PE", displayOptions);

  const currentHM = now.getHours().toString().padStart(2, "0") + ":" +
                    now.getMinutes().toString().padStart(2, "0");
  checkAlarms(currentHM);
}

function setManualTime() {
  try {
    if (!elements.manualClock.value) {
      throw new Error("Debes seleccionar una hora para el reloj.");
    }
    
    const today = new Date();
    const [h, m] = elements.manualClock.value.split(":");
    manualTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0);
    usingManualClock = true;
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
  }
}

// ================== AUDIO ==================
function initializeAudio() {
  elements.alarmSound.play().then(() => {
    elements.alarmSound.pause();
    elements.alarmSound.currentTime = 0;
  }).catch(err => console.log("Audio bloqueado:", err));
}

// ================== ALARMAS ==================
function checkAlarms(current) {
  habits.forEach(habit => {
    const today = new Date().toLocaleDateString("es-PE");
    const alreadyLogged = activities.find(
      a => a.habitId === habit.id && a.date === today
    );
    if (habit.time === current && !alreadyLogged) {
      startAlarm(habit);
    }
  });
}

function startAlarm(habit) {
  currentHabit = habit;
  showMessage(`⏰ ¡Es hora de: ${habit.name}!`);
  showStopButton();
  playAlarm();

  alarmTimeout = setTimeout(() => {
    if (currentHabit) {
      saveActivity(currentHabit, false);
      if (!currentHabit.repeat) deleteHabitById(currentHabit.id);
      stopAlarm(false);
    }
  }, 10000);
}

function playAlarm() {
  elements.alarmSound.currentTime = 0;
  elements.alarmSound.play().catch(err => console.log("Error sonido:", err));
}

function stopAlarm(done = true) {
  elements.alarmSound.pause();
  elements.alarmSound.currentTime = 0;
  
  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
  }

  if (currentHabit) {
    saveActivity(currentHabit, done);
    if (!currentHabit.repeat) deleteHabitById(currentHabit.id);
    currentHabit = null;
  }

  removeMessage();
  removeStopButton();
}

// ================== ACTIVIDADES ==================
async function saveActivity(habit, completed) {
  const today = new Date().toLocaleDateString("es-PE");

  const exists = activities.some(
    a => a.habitId === habit.id && a.date === today
  );
  
  if (exists) return;

  const nuevaActividad = {
    habitId: habit.id,
    name: habit.name,
    time: habit.time,
    status: completed ? "✅ Cumplido" : "❌ No cumplido",
    statusClass: completed ? "done" : "fail",
    date: today
  };

  activities.push(nuevaActividad);
  renderActivities();
  
  // ✅ GUARDAR EN MYSQL CON FORM DATA
  await guardarActividadEnMySQL(habit, completed);
}

async function guardarActividadEnMySQL(habit, completed) {
  if (!usuarioActual) return;

  try {
    const formData = new FormData();
    formData.append('usuario_id', usuarioActual.id);
    formData.append('habito_id', habit.id);
    formData.append('nombre', habit.name);
    formData.append('hora', habit.time);
    formData.append('estado', completed ? 'completado' : 'no_completado');

    await fetch(`${API_BASE_URL}/historial/guardar`, {
      method: 'POST',
      body: formData
    });

  } catch (error) {
    console.error('Error guardando actividad en MySQL:', error);
  }
}

function renderActivities() {
  if (!elements.activityList) return;
  
  elements.activityList.innerHTML = "";
  let doneCount = 0;
  let failCount = 0;

  const filtered = activities.filter(a => {
    if (elements.filterSelect.value === "done") return a.statusClass === "done";
    if (elements.filterSelect.value === "fail") return a.statusClass === "fail";
    return true;
  });

  filtered.forEach(a => {
    if (a.statusClass === "done") doneCount++;
    if (a.statusClass === "fail") failCount++;

    elements.activityList.innerHTML += `
      <div class="item">
        <span>${a.name}</span>
        <span>${a.time}</span>
        <span class="status ${a.statusClass}">${a.status}</span>
        <span>${a.date}</span>
      </div>`;
  });

  if (elements.activityCounters) {
    elements.activityCounters.textContent =
      `✅ Cumplidos: ${doneCount} | ❌ No cumplidos: ${failCount}`;
  }
}

// ================== HÁBITOS ==================
async function addHabit() {
  try {
    if (!elements.habitName.value.trim()) {
      throw new Error("Debes ingresar un nombre para el hábito.");
    }
    
    if (!elements.habitTime.value) {
      throw new Error("Debes seleccionar una hora para el hábito.");
    }
    
    if (elements.habitName.value.trim().length > 30) {
      throw new Error("El nombre del hábito no puede tener más de 30 caracteres.");
    }
    
    const normalizedTime = normalizeTime(elements.habitTime.value);
    const duplicateHabit = habits.find(h => h.time === normalizedTime);
    
    if (duplicateHabit) {
      throw new Error(`Ya existe un hábito (${duplicateHabit.name}) programado para las ${normalizedTime}.`);
    }

    await saveHabit();
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
  }
}

async function saveHabit() {
  const normalizedTime = normalizeTime(elements.habitTime.value);

  const nuevoHabit = {
    id: Date.now().toString(),
    name: elements.habitName.value.trim(),
    time: normalizedTime,
    repeat: false, // Por defecto no se repite
    activo: false  // Campo para el backend
  };

  habits.push(nuevoHabit);
  
  // ✅ GUARDAR EN MYSQL CON FORM DATA
  await guardarHabitoEnMySQL(nuevoHabit);
  
  elements.habitName.value = "";
  elements.habitTime.value = "";
  renderHabits();
}

async function guardarHabitoEnMySQL(habit) {
  if (!usuarioActual) return;

  try {
    const formData = new FormData();
    formData.append('usuario_id', usuarioActual.id);
    formData.append('nombre', habit.name);
    formData.append('hora', habit.time);
    formData.append('activo', habit.activo ? '1' : '0'); // ✅ Usar campo 'activo' en lugar de 'repeat'

    console.log('Guardando hábito:', {
      usuario_id: usuarioActual.id,
      nombre: habit.name,
      hora: habit.time,
      activo: habit.activo
    });

    await fetch(`${API_BASE_URL}/habitos/guardar`, {
      method: 'POST',
      body: formData
    });

  } catch (error) {
    console.error('Error guardando hábito en MySQL:', error);
    showModal('❌ Error guardando hábito. Intenta nuevamente.');
  }
}

function normalizeTime(timeStr) {
  const [h, m] = timeStr.split(":");
  return h.padStart(2, "0") + ":" + m.padStart(2, "0");
}

function renderHabits() {
  if (!elements.habitList) return;

  elements.habitList.innerHTML = "";
  habits.sort((a, b) => {
    if (!a.time || !b.time) return 0;
    return a.time.localeCompare(b.time);
  });

  habits.forEach((h, i) => {
    const timeValue = h.time || "";
    elements.habitList.innerHTML += `
      <div class="item">
        <input type="text" value="${h.name || ""}" onchange="updateName(${i}, this.value)">
        <input type="time" value="${timeValue}" onchange="updateTime(${i}, this.value)">
        <label>
          <input type="checkbox" ${h.repeat ? "checked" : ""} onchange="updateRepeat(${i}, this.checked)"> 🔁
        </label>
        <button onclick="deleteHabit(${i})">❌</button>
      </div>`;
  });
}

// ================== GESTIÓN DE HÁBITOS ==================
async function deleteHabit(index) {
  const habitToDelete = habits[index];
  
  // ELIMINAR DE MYSQL
  if (usuarioActual && habitToDelete) {
    try {
      await eliminarHabitoDeMySQL(habitToDelete);
    } catch (error) {
      console.error('Error eliminando hábito de MySQL:', error);
    }
  }
  
  // Eliminar localmente
  habits.splice(index, 1);
  renderHabits();
}

async function eliminarHabitoDeMySQL(habit) {
  try {
    const formData = new FormData();
    formData.append('usuario_id', usuarioActual.id);
    formData.append('nombre', habit.name);
    formData.append('hora', habit.time);

    await fetch(`${API_BASE_URL}/habitos/eliminar`, {
      method: 'DELETE',
      body: formData
    });

  } catch (error) {
    console.error('Error eliminando hábito de MySQL:', error);
    throw error;
  }
}

function deleteHabitById(id) {
  const habitIndex = habits.findIndex(h => h.id === id);
  if (habitIndex !== -1) {
    deleteHabit(habitIndex);
  }
}

async function updateTime(index, time) {
  try {
    if (!time) throw new Error("La hora no puede estar vacía.");
    
    const normalizedTime = normalizeTime(time);
    const duplicateHabit = habits.find((h, i) => h.time === normalizedTime && i !== index);
    
    if (duplicateHabit) {
      throw new Error(`Ya existe un hábito (${duplicateHabit.name}) programado para las ${normalizedTime}.`);
    }
    
    const oldHabit = {...habits[index]};
    habits[index].time = normalizedTime;
    
    // ✅ ACTUALIZAR EN MYSQL
    await actualizarHabitoEnMySQL(oldHabit, habits[index]);
    renderHabits();
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
    renderHabits();
  }
}

async function updateName(index, newName) {
  try {
    if (!newName.trim()) throw new Error("El nombre no puede estar vacío.");
    
    if (newName.trim().length > 30) {
      throw new Error("El nombre del hábito no puede tener más de 30 caracteres.");
    }
    
    const oldHabit = {...habits[index]};
    habits[index].name = newName.trim();
    
    // ✅ ACTUALIZAR EN MYSQL
    await actualizarHabitoEnMySQL(oldHabit, habits[index]);
    renderHabits();
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
    renderHabits();
  }
}

async function updateRepeat(index, value) {
  const oldHabit = {...habits[index]};
  habits[index].repeat = value;
  habits[index].activo = value; // ✅ Actualizar también el campo 'activo'

  console.log('Actualizando repeat para hábito:', {
    index,
    repeat: value,
    activo: value,
    habit: habits[index]
  });

  // ✅ ACTUALIZAR EN MYSQL
  await actualizarHabitoEnMySQL(oldHabit, habits[index]);
}

async function actualizarHabitoEnMySQL(oldHabit, newHabit) {
  if (!usuarioActual) return;

  try {
    // Primero eliminar el viejo
    await eliminarHabitoDeMySQL(oldHabit);
    
    // Luego agregar el nuevo
    await guardarHabitoEnMySQL(newHabit);
    
  } catch (error) {
    console.error('Error actualizando hábito en MySQL:', error);
  }
}

// ================== INTERFAZ ==================
function showMessage(message) {
  let box = document.getElementById("alarmBox");
  
  if (!box) {
    box = document.createElement("div");
    box.id = "alarmBox";
    box.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: var(--danger-color);
      color: white;
      font-weight: bold;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      animation: blink 1s infinite;
    `;
    document.body.appendChild(box);
  }
  
  box.textContent = message;
}

function removeMessage() {
  const box = document.getElementById("alarmBox");
  if (box) box.remove();
}

function showStopButton() {
  if (!document.getElementById("stopAlarmBtn")) {
    const button = document.createElement("button");
    button.id = "stopAlarmBtn";
    button.textContent = "Detener alarma";
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: var(--primary-color);
      color: white;
      font-weight: bold;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    button.onclick = () => stopAlarm(true);
    document.body.appendChild(button);
  }
}

function removeStopButton() {
  const button = document.getElementById("stopAlarmBtn");
  if (button) button.remove();
}

// ================== MODAL ==================
function showModal(message, withCancel = false, callback = null) {
  elements.modalMessage.textContent = message;
  elements.modalButtons.innerHTML = "";

  const okButton = document.createElement("button");
  okButton.textContent = "Aceptar";
  okButton.onclick = () => {
    closeModal();
    if (callback) callback(true);
  };
  
  elements.modalButtons.appendChild(okButton);

  if (withCancel) {
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancelar";
    cancelButton.onclick = () => {
      closeModal();
      if (callback) callback(false);
    };
    
    elements.modalButtons.appendChild(cancelButton);
  }

  elements.modal.style.display = "flex";
}

function closeModal() {
  elements.modal.style.display = "none";
}

// ================== SESIÓN ==================
function cerrarSesion(event) {
    event.preventDefault();
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/';
}


// ================== SINCRONIZACIÓN ==================
async function sincronizarHabitos() {
  if (!usuarioActual) {
    showModal('❌ No hay usuario activo');
    return;
  }

  try {
    showModal('🔄 Sincronizando hábitos...');
    console.log('Sincronizando hábitos para usuario:', usuarioActual.id);

    // Recargar hábitos programados
    console.log('Cargando hábitos programados...');
    await cargarHabitosProgramados();
    console.log('Hábitos programados cargados:', habits.length);

    // Recargar historial
    console.log('Cargando historial...');
    await cargarHistorialDesdeMySQL();
    console.log('Historial cargado:', activities.length);

    // Actualizar información del perfil
    console.log('Actualizando perfil...');
    await cargarPerfilUsuario();

    closeModal();
    showModal(`✅ Hábitos sincronizados correctamente\nHábitos: ${habits.length} | Historial: ${activities.length}`);

  } catch (error) {
    console.error('Error sincronizando hábitos:', error);
    closeModal();
    showModal(`❌ Error al sincronizar hábitos: ${error.message}`);
  }
}

// ================== INICIALIZAR APLICACIÓN ==================
initializeApp();

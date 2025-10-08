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

let habits = JSON.parse(localStorage.getItem("habits")) || [];
let activities = JSON.parse(localStorage.getItem("activities")) || [];
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
  migrateHabitsWithIds();
  renderHabits();
  renderActivities();
  cargarPerfilUsuario();
}

function verificarSesion() {
  const usuarioGuardado = localStorage.getItem('usuarioActual');
  if (!usuarioGuardado) {
    window.location.href = '../Inicio_Sesion/login.html';
    return;
  }
  
  usuarioActual = JSON.parse(usuarioGuardado);
  elements.userName.textContent = usuarioActual.nombre;
}

async function cargarPerfilUsuario() {
  if (!usuarioActual) return;
  
  try {
    const respuesta = await fetch(`${API_BASE_URL}/perfiles/${usuarioActual.id}`);
    if (respuesta.ok) {
      perfilUsuario = await respuesta.json();
      
      if (perfilUsuario) {
        mostrarInformacionPerfil();
        cargarHabitosProgramados();
        cargarHistorialDesdeBackend(); // ✅ NUEVO - Carga historial persistente
      }
    }
  } catch (error) {
    console.error('Error cargando perfil:', error);
  }
}

// ✅ NUEVA FUNCIÓN: Cargar historial desde backend (PERSISTENCIA)
async function cargarHistorialDesdeBackend() {
  if (!perfilUsuario) return;
  
  try {
    // Cargar historial desde el backend
    if (perfilUsuario.historial_habitos && perfilUsuario.historial_habitos.length > 0) {
      const historialBackend = perfilUsuario.historial_habitos;
      
      // Convertir historial del backend al formato del frontend
      historialBackend.forEach(habitoBackend => {
        const existe = activities.find(a => a.habitId === habitoBackend.id);
        if (!existe) {
          activities.push({
            habitId: habitoBackend.id,
            name: habitoBackend.nombre,
            time: habitoBackend.hora,
            status: habitoBackend.estado === 'completado' ? "✅ Cumplido" : "❌ No cumplido",
            statusClass: habitoBackend.estado === 'completado' ? "done" : "fail",
            date: new Date(habitoBackend.fecha).toLocaleDateString("es-PE")
          });
        }
      });
      
      localStorage.setItem("activities", JSON.stringify(activities));
      renderActivities();
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
    <p><strong>📊 Hábitos programados:</strong> ${perfilUsuario.habitos_programados ? perfilUsuario.habitos_programados.length : 0}</p>
    <p><strong>📈 Historial de hábitos:</strong> ${perfilUsuario.historial_habitos ? perfilUsuario.historial_habitos.length : 0}</p>
  `;
}

function cargarHabitosProgramados() {
  if (!perfilUsuario || !perfilUsuario.habitos_programados) return;
  
  const habitosBackend = perfilUsuario.habitos_programados;
  
  habitosBackend.forEach(habitoBackend => {
    const existe = habits.find(h => h.id === habitoBackend.id);
    if (!existe) {
      habits.push({
        id: habitoBackend.id,
        name: habitoBackend.nombre,
        time: habitoBackend.hora,
        repeat: habitoBackend.activo || false
      });
    }
  });
  
  localStorage.setItem("habits", JSON.stringify(habits));
  renderHabits();
}

async function sincronizarHabitos() {
  if (!perfilUsuario) {
    showModal('❌ Primero debes tener un perfil registrado');
    return;
  }

  try {
    for (const habit of habits) {
      const habitData = {
        nombre: habit.name,
        hora: habit.time,
        categoria: 'salud',
        activo: habit.repeat || true
      };

      const response = await fetch(`${API_BASE_URL}/perfiles/${perfilUsuario.id}/habitos-programados`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(habitData)
      });

      if (!response.ok) {
        throw new Error('Error sincronizando hábito programado');
      }
    }

    await cargarPerfilUsuario();
    showModal('✅ Hábitos sincronizados exitosamente con tu perfil');

  } catch (error) {
    showModal(`❌ Error sincronizando hábitos: ${error.message}`);
  }
}

// ================== CONFIGURACIÓN ==================
function loadSettings() {
  let currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  
  let timeFormat = localStorage.getItem("timeFormat") || "24";
  elements.formatSelect.value = timeFormat;
  
  let activityFilter = localStorage.getItem("activityFilter") || "all";
  elements.filterSelect.value = activityFilter;
}

function setupEventListeners() {
  elements.formatSelect.addEventListener("change", () => {
    localStorage.setItem("timeFormat", elements.formatSelect.value);
  });
  
  elements.filterSelect.addEventListener("change", () => {
    localStorage.setItem("activityFilter", elements.filterSelect.value);
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
    const alreadyLogged = activities.find(
      a => a.habitId === habit.id && a.date === new Date().toLocaleDateString("es-PE")
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
function saveActivity(habit, completed) {
  const today = new Date().toLocaleDateString("es-PE");

  const exists = activities.some(
    a => a.habitId === habit.id && a.date === today
  );
  
  if (exists) return;

  activities.push({
    habitId: habit.id,
    name: habit.name,
    time: habit.time,
    status: completed ? "✅ Cumplido" : "❌ No cumplido",
    statusClass: completed ? "done" : "fail",
    date: today
  });

  localStorage.setItem("activities", JSON.stringify(activities));
  renderActivities();
  
  // ✅ GUARDAR EN BACKEND PARA PERSISTENCIA
  guardarActividadEnPerfil(habit, completed);
}

async function guardarActividadEnPerfil(habit, completed) {
  if (!perfilUsuario) return;

  try {
    const activityData = {
      nombre: habit.name,
      hora: habit.time,
      estado: completed ? 'completado' : 'no_completado'
    };

    await fetch(`${API_BASE_URL}/perfiles/${perfilUsuario.id}/historial-habitos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData)
    });

  } catch (error) {
    console.error('Error guardando actividad en historial:', error);
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

    const now = new Date();
    const currentHM = now.getHours().toString().padStart(2, "0") + ":" +
                      now.getMinutes().toString().padStart(2, "0");

    if (normalizedTime < currentHM) {
      showModal(
        `⏰ La hora elegida (${normalizedTime}) es anterior al reloj (${currentHM}). 
La alarma sonará mañana. ¿Deseas continuar?`,
        true,
        async (ok) => {
          if (ok) {
            await saveHabit();
            if (perfilUsuario) {
              await sincronizarHabitoIndividual(elements.habitName.value.trim(), normalizedTime);
            }
          } else {
            elements.habitTime.focus();
          }
        }
      );
      return;
    }

    await saveHabit();
    if (perfilUsuario) {
      await sincronizarHabitoIndividual(elements.habitName.value.trim(), normalizedTime);
    }
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
  }
}

async function sincronizarHabitoIndividual(nombre, hora) {
  try {
    const habitData = {
      nombre: nombre,
      hora: hora,
      categoria: 'salud',
      activo: true
    };

    await fetch(`${API_BASE_URL}/perfiles/${perfilUsuario.id}/habitos-programados`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(habitData)
    });

  } catch (error) {
    console.error('Error sincronizando hábito individual:', error);
  }
}

async function saveHabit() {
  const normalizedTime = normalizeTime(elements.habitTime.value);

  const nuevoHabit = {
    id: Date.now().toString(),
    name: elements.habitName.value.trim(),
    time: normalizedTime,
    repeat: false
  };

  habits.push(nuevoHabit);
  localStorage.setItem("habits", JSON.stringify(habits));
  elements.habitName.value = "";
  elements.habitTime.value = "";
  renderHabits();
}

function normalizeTime(timeStr) {
  const [h, m] = timeStr.split(":");
  return h.padStart(2, "0") + ":" + m.padStart(2, "0");
}

function renderHabits() {
  if (!elements.habitList) return;
  
  elements.habitList.innerHTML = "";
  habits.sort((a, b) => a.time.localeCompare(b.time));

  habits.forEach((h, i) => {
    elements.habitList.innerHTML += `
      <div class="item">
        <input type="text" value="${h.name}" onchange="updateName(${i}, this.value)">
        <input type="time" value="${h.time}" onchange="updateTime(${i}, this.value)">
        <label>
          <input type="checkbox" ${h.repeat ? "checked" : ""} onchange="updateRepeat(${i}, this.checked)"> 🔁
        </label>
        <button onclick="deleteHabit(${i})">❌</button>
      </div>`;
  });
}

// ================== GESTIÓN DE HÁBITOS ==================
// ✅ FUNCIÓN MEJORADA: Eliminar hábito también del backend
async function deleteHabit(index) {
  const habitToDelete = habits[index];
  
  // ELIMINAR DEL BACKEND SI EXISTE EN EL PERFIL
  if (perfilUsuario && habitToDelete.id) {
    try {
      // Buscar si el hábito existe en el backend
      const habitosBackend = perfilUsuario.habitos_programados || [];
      const habitoBackend = habitosBackend.find(h => h.nombre === habitToDelete.name && h.hora === habitToDelete.time);
      
      if (habitoBackend) {
        // Actualizamos la lista completa sin el hábito eliminado
        const habitosActualizados = habitosBackend.filter(h => 
          !(h.nombre === habitToDelete.name && h.hora === habitToDelete.time)
        );
        
        await fetch(`${API_BASE_URL}/perfiles/${perfilUsuario.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            habitos_programados: habitosActualizados
          })
        });
        
        console.log('Hábito eliminado del backend:', habitToDelete.name);
      }
    } catch (error) {
      console.error('Error eliminando hábito del backend:', error);
    }
  }
  
  // Eliminar localmente
  habits.splice(index, 1);
  localStorage.setItem("habits", JSON.stringify(habits));
  renderHabits();
}

function deleteHabitById(id) {
  habits = habits.filter(h => h.id !== id);
  localStorage.setItem("habits", JSON.stringify(habits));
  renderHabits();
}

function updateTime(index, time) {
  try {
    if (!time) throw new Error("La hora no puede estar vacía.");
    
    const normalizedTime = normalizeTime(time);
    const duplicateHabit = habits.find((h, i) => h.time === normalizedTime && i !== index);
    
    if (duplicateHabit) {
      throw new Error(`Ya existe un hábito (${duplicateHabit.name}) programado para las ${normalizedTime}.`);
    }
    
    habits[index].time = normalizedTime;
    localStorage.setItem("habits", JSON.stringify(habits));
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
    renderHabits();
  }
}

function updateName(index, newName) {
  try {
    if (!newName.trim()) throw new Error("El nombre no puede estar vacío.");
    
    if (newName.trim().length > 30) {
      throw new Error("El nombre del hábito no puede tener más de 30 caracteres.");
    }
    
    habits[index].name = newName.trim();
    localStorage.setItem("habits", JSON.stringify(habits));
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
    renderHabits();
  }
}

function updateRepeat(index, value) {
  habits[index].repeat = value;
  localStorage.setItem("habits", JSON.stringify(habits));
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

// ================== MIGRACIÓN DE DATOS ==================
function migrateHabitsWithIds() {
  const oldHabits = JSON.parse(localStorage.getItem("habits")) || [];
  const hasIds = oldHabits.some(h => h.id);
  
  if (!hasIds && oldHabits.length > 0) {
    const migratedHabits = oldHabits.map(habit => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: habit.name,
      time: habit.time,
      repeat: habit.repeat || false
    }));
    
    localStorage.setItem("habits", JSON.stringify(migratedHabits));
    habits = migratedHabits;
    renderHabits();
  }
}

// ================== SESIÓN ==================
function cerrarSesion() {
  if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
    localStorage.removeItem('usuarioActual');
    localStorage.removeItem('habits');
    localStorage.removeItem('activities');
    window.location.href = '../Inicio_Sesion/login.html';
  }
}

// ================== INICIALIZAR APLICACIÓN ==================
initializeApp();
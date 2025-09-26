// ================== CONSTANTES Y VARIABLES ==================
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
  themeSelect: document.getElementById("themeSelect"),
  modal: document.getElementById("modal"),
  modalMessage: document.getElementById("modalMessage"),
  modalButtons: document.getElementById("modalButtons")
};

let habits = JSON.parse(localStorage.getItem("habits")) || [];
let activities = JSON.parse(localStorage.getItem("activities")) || [];
let currentHabit = null;
let manualTime = null;
let usingManualClock = false;
let alarmTimeout = null;

// ================== INICIALIZACIÓN ==================
function initializeApp() {
  loadSettings();
  setupEventListeners();
  startClock();
  migrateHabitsWithIds();
  renderHabits();
  renderActivities();
}

// ================== CONFIGURACIÓN ==================
function loadSettings() {
  // Tema
  let currentTheme = localStorage.getItem("theme") || "light";
  elements.themeSelect.value = currentTheme;
  document.documentElement.setAttribute("data-theme", currentTheme);
  
  // Formato de hora
  let timeFormat = localStorage.getItem("timeFormat") || "24";
  elements.formatSelect.value = timeFormat;
  
  // Filtro de historial
  let activityFilter = localStorage.getItem("activityFilter") || "all";
  elements.filterSelect.value = activityFilter;
}

function setupEventListeners() {
  // Selector de tema
  elements.themeSelect.addEventListener("change", handleThemeChange);
  
  // Formato de hora
  elements.formatSelect.addEventListener("change", () => {
    localStorage.setItem("timeFormat", elements.formatSelect.value);
  });
  
  // Filtro de historial
  elements.filterSelect.addEventListener("change", () => {
    localStorage.setItem("activityFilter", elements.filterSelect.value);
    renderActivities();
  });
  
  // Botones
  elements.addHabitBtn.addEventListener("click", addHabit);
  elements.setClockBtn.addEventListener("click", setManualTime);
  
  // Audio
  document.addEventListener("click", initializeAudio, { once: true });
}

// ================== MANEJO DE TEMAS ==================
function handleThemeChange() {
  try {
    const newTheme = elements.themeSelect.value;
    const currentTheme = document.documentElement.getAttribute("data-theme");
    
    if (newTheme === currentTheme) {
      throw new Error(`El tema ${getThemeName(newTheme)} ya está activo.`);
    }
    
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
    // Restaurar el valor anterior
    elements.themeSelect.value = document.documentElement.getAttribute("data-theme");
  }
}

function getThemeName(theme) {
  const themeNames = {
    light: "Claro",
    dark: "Oscuro",
    blue: "Azul",
    green: "Verde"
  };
  return themeNames[theme] || theme;
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

  // Evitar duplicados (mismo hábito, misma hora, misma fecha)
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
}

function renderActivities() {
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

  elements.activityCounters.textContent =
    `✅ Cumplidos: ${doneCount} | ❌ No cumplidos: ${failCount}`;
}

// ================== HÁBITOS ==================
function addHabit() {
  try {
    // Validar campos vacíos
    if (!elements.habitName.value.trim()) {
      throw new Error("Debes ingresar un nombre para el hábito.");
    }
    
    if (!elements.habitTime.value) {
      throw new Error("Debes seleccionar una hora para el hábito.");
    }
    
    // Validar nombre muy largo
    if (elements.habitName.value.trim().length > 30) {
      throw new Error("El nombre del hábito no puede tener más de 30 caracteres.");
    }
    
    // Validar hora duplicada
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
        ok => {
          if (ok) saveHabit();
          else elements.habitTime.focus();
        }
      );
      return;
    }

    saveHabit();
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
  }
}

function normalizeTime(timeStr) {
  const [h, m] = timeStr.split(":");
  return h.padStart(2, "0") + ":" + m.padStart(2, "0");
}

function saveHabit() {
  const normalizedTime = normalizeTime(elements.habitTime.value);

  habits.push({
    id: Date.now().toString(),
    name: elements.habitName.value.trim(),
    time: normalizedTime,
    repeat: false
  });

  localStorage.setItem("habits", JSON.stringify(habits));
  elements.habitName.value = "";
  elements.habitTime.value = "";
  renderHabits();
}

function renderHabits() {
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
function deleteHabit(index) {
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
    
    // Validar hora duplicada
    const normalizedTime = normalizeTime(time);
    const duplicateHabit = habits.find((h, i) => h.time === normalizedTime && i !== index);
    
    if (duplicateHabit) {
      throw new Error(`Ya existe un hábito (${duplicateHabit.name}) programado para las ${normalizedTime}.`);
    }
    
    habits[index].time = normalizedTime;
    localStorage.setItem("habits", JSON.stringify(habits));
    
  } catch (error) {
    showModal(`⚠️ ${error.message}`);
    // Restaurar el valor original
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
    // Restaurar el valor original
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

// ================== CONTADOR DE HÁBITOS ==================
function setupHabitCounter() {
    const counter = document.createElement('div');
    counter.id = 'habitCounter';
    counter.style.fontWeight = '600';
    counter.style.color = 'var(--primary-color)';
    counter.style.marginTop = '10px';
    
    document.querySelector('#habitList').closest('.card').insertBefore(counter, document.querySelector('#habitList'));
    
    function updateCounter() {
        counter.textContent = `📊 Total de hábitos: ${habits.length}`;
    }
    
    updateCounter();
    // Actualizar cada vez que se modifiquen los hábitos
    const originalRender = renderHabits;
    renderHabits = function() {
        originalRender();
        updateCounter();
    };
}

// Inicializar después de que todo esté cargado
setTimeout(setupHabitCounter, 100);


// ================== INICIALIZAR APLICACIÓN ==================
initializeApp();
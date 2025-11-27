const API_BASE_URL = 'http://localhost:5000';
let perfiles = [];
let perfilEditando = null;
let perfilAEliminar = null;

// Cargar perfiles al iniciar
document.addEventListener('DOMContentLoaded', function() {
    if (verificarAdmin()) {
        cargarPerfiles();
        setInterval(cargarPerfiles, 30000);
    }
});

function verificarAdmin() {
    const esAdmin = sessionStorage.getItem('esAdministrador');
    const usuarioActual = sessionStorage.getItem('usuarioActual');
    
    console.log('Verificando admin:', esAdmin);
    console.log('Usuario actual:', usuarioActual);
    
    if (!esAdmin || esAdmin !== 'true') {
        mostrarMensaje('❌ Acceso denegado. Debes iniciar sesión como administrador.', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        return false;
    }
    
    if (usuarioActual) {
        const usuario = JSON.parse(usuarioActual);
        document.querySelector('.admin-welcome').textContent = `👋 Hola, ${usuario.nombre}`;
    }
    
    return true;
}

async function cargarPerfiles() {
    try {
        mostrarLoading(true);
        const respuesta = await fetch(`${API_BASE_URL}/perfiles`);
        if (!respuesta.ok) throw new Error('Error al cargar usuarios');
        
        perfiles = await respuesta.json();
        mostrarPerfiles();
        actualizarEstadisticas();
    } catch (error) {
        document.getElementById('cuerpoTabla').innerHTML = 
            '<tr><td colspan="7" class="error">❌ Error cargando usuarios: ' + error.message + '</td></tr>';
    } finally {
        mostrarLoading(false);
    }
}

function mostrarLoading(mostrar) {
    const cuerpoTabla = document.getElementById('cuerpoTabla');
    if (mostrar) {
        cuerpoTabla.innerHTML = `
            <tr>
                <td colspan="7" class="loading">
                    <div class="loading-spinner"></div>
                    Cargando usuarios...
                </td>
            </tr>
        `;
    }
}

function mostrarPerfiles() {
    const cuerpoTabla = document.getElementById('cuerpoTabla');
    
    if (perfiles.length === 0) {
        cuerpoTabla.innerHTML = `
            <tr>
                <td colspan="7" class="loading">
                    📝 No hay usuarios registrados
                </td>
            </tr>
        `;
        return;
    }

    cuerpoTabla.innerHTML = perfiles.map((perfil, index) => {
        const totalHabitos = perfil.historial_habitos ? perfil.historial_habitos.length : 0;
        const habitosCompletados = perfil.historial_habitos ? 
            perfil.historial_habitos.filter(h => h.estado === 'completado').length : 0;
        
        return `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>
                    <div class="user-info">
                        <div class="user-name">${perfil.nombre}</div>
                        <div class="user-id">ID: ${perfil.id.substring(0, 8)}...</div>
                    </div>
                </td>
                <td>${perfil.email}</td>
                <td>${new Date(perfil.fecha_creacion).toLocaleDateString('es-ES')}</td>
                <td>
                    <div class="habitos-stats">
                        <span class="habitos-total">${totalHabitos}</span>
                        <small>(${habitosCompletados} completados)</small>
                    </div>
                </td>
                <td>
                    <span class="badge ${totalHabitos > 0 ? 'badge-activo' : 'badge-inactivo'}">
                        ${totalHabitos > 0 ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-primary btn-sm" onclick="verDetalles('${perfil.id}')" title="Ver detalles">
                        <span class="btn-icon">👁️</span>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="editarPerfil('${perfil.id}')" title="Editar">
                        <span class="btn-icon">✏️</span>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="solicitarEliminacion('${perfil.id}', '${perfil.nombre}')" title="Eliminar">
                        <span class="btn-icon">🗑️</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('usuariosMostrados').textContent = perfiles.length;
    document.getElementById('totalUsuariosTabla').textContent = perfiles.length;
}

function filtrarUsuarios() {
    const busqueda = document.getElementById('buscarUsuario').value.toLowerCase();
    const filas = document.querySelectorAll('#cuerpoTabla tr');
    let usuariosVisibles = 0;

    filas.forEach(fila => {
        const textoFila = fila.textContent.toLowerCase();
        if (textoFila.includes(busqueda)) {
            fila.style.display = '';
            usuariosVisibles++;
        } else {
            fila.style.display = 'none';
        }
    });

    document.getElementById('usuariosMostrados').textContent = usuariosVisibles;
}

function actualizarEstadisticas() {
    const totalUsuarios = perfiles.length;
    const totalHabitos = perfiles.reduce((total, perfil) => 
        total + (perfil.historial_habitos ? perfil.historial_habitos.length : 0), 0);
    
    const habitosCompletados = perfiles.reduce((total, perfil) => {
        if (!perfil.historial_habitos) return total;
        return total + perfil.historial_habitos.filter(h => h.estado === 'completado').length;
    }, 0);

    const hoy = new Date().toISOString().split('T')[0];
    const habitosHoy = perfiles.reduce((total, perfil) => {
        if (!perfil.historial_habitos) return total;
        return total + perfil.historial_habitos.filter(h => 
            h.fecha && h.fecha.startsWith(hoy)
        ).length;
    }, 0);

    document.getElementById('totalUsuarios').textContent = totalUsuarios;
    document.getElementById('totalHabitos').textContent = totalHabitos;
    document.getElementById('habitosCompletados').textContent = habitosCompletados;
    document.getElementById('habitosHoy').textContent = habitosHoy;
}



async function verDetalles(idPerfil) {
    try {
        const respuesta = await fetch(`${API_BASE_URL}/perfiles/${idPerfil}`);
        if (!respuesta.ok) throw new Error('Usuario no encontrado');
        
        const perfil = await respuesta.json();
        
        const contenido = `
            <div class="detalles-grid">
                <div class="detalle-item">
                    <label>ID:</label>
                    <span class="monospace">${perfil.id}</span>
                </div>
                <div class="detalle-item">
                    <label>Nombre:</label>
                    <span>${perfil.nombre}</span>
                </div>
                <div class="detalle-item">
                    <label>Email:</label>
                    <span>${perfil.email}</span>
                </div>
                <div class="detalle-item">
                    <label>Fecha de Registro:</label>
                    <span>${new Date(perfil.fecha_creacion).toLocaleString('es-ES')}</span>
                </div>
            </div>

            <div class="preferencias-section">
                <h4>⚙️ Preferencias:</h4>
                <div class="preferencias-grid">
                    <div class="preferencia-item">
                        <label>Tema:</label>
                        <span>${perfil.preferencias?.tema || 'light'}</span>
                    </div>
                    <div class="preferencia-item">
                        <label>Formato Hora:</label>
                        <span>${perfil.preferencias?.formato_hora || '24'}</span>
                    </div>
                    <div class="preferencia-item">
                        <label>Notificaciones:</label>
                        <span>${perfil.preferencias?.notificaciones ? '✅ Activadas' : '❌ Desactivadas'}</span>
                    </div>
                </div>
            </div>

            <div class="habitos-section">
                <h4>📊 Hábitos Registrados (${perfil.historial_habitos?.length || 0}):</h4>
                <div class="habitos-list">
                    ${perfil.historial_habitos && perfil.historial_habitos.length > 0 
                        ? perfil.historial_habitos.map(habito => `
                            <div class="habito-item">
                                <strong>${habito.nombre}</strong> - ${habito.hora}<br>
                                <small>Estado: ${habito.estado} | Fecha: ${new Date(habito.fecha).toLocaleDateString('es-ES')}</small>
                            </div>
                        `).join('')
                        : '<p class="no-data">📝 No hay hábitos registrados</p>'
                    }
                </div>
            </div>
        `;
        
        document.getElementById('detallesContenido').innerHTML = contenido;
        document.getElementById('modalDetalles').style.display = 'flex';
    } catch (error) {
        mostrarMensaje('❌ Error cargando detalles: ' + error.message, 'error');
    }
}

async function editarPerfil(idPerfil) {
    const perfil = perfiles.find(p => p.id === idPerfil);
    if (!perfil) return;

    perfilEditando = idPerfil;
    document.getElementById('editarNombre').value = perfil.nombre;
    document.getElementById('editarEmail').value = perfil.email;
    
    document.getElementById('modalEditar').style.display = 'flex';
}

async function guardarCambios() {
    if (!perfilEditando) return;

    const nombre = document.getElementById('editarNombre').value.trim();
    const email = document.getElementById('editarEmail').value.trim();

    if (!nombre || !email) {
        mostrarMensaje('❌ Por favor complete todos los campos', 'error');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('nombre', nombre);
        formData.append('email', email);

        const respuesta = await fetch(`${API_BASE_URL}/perfiles/${perfilEditando}`, {
            method: 'PUT',
            body: formData
        });

        if (respuesta.ok) {
            mostrarMensaje('✅ Usuario actualizado exitosamente!', 'success');
            cerrarModal();
            cargarPerfiles();
        } else {
            const error = await respuesta.json();
            mostrarMensaje('❌ Error: ' + error.error, 'error');
        }
    } catch (error) {
        mostrarMensaje('❌ Error de conexión con el servidor', 'error');
    }
}

function solicitarEliminacion(idPerfil, nombreUsuario) {
    perfilAEliminar = idPerfil;
    document.getElementById('mensajeConfirmacion').textContent = 
        `¿Está seguro de que desea eliminar al usuario "${nombreUsuario}"?\n\nEsta acción no se puede deshacer y se perderán todos los datos del usuario.`;
    document.getElementById('modalConfirmacion').style.display = 'flex';
}

function confirmarEliminacion() {
    if (!perfilAEliminar) return;
    eliminarPerfil(perfilAEliminar);
    cancelarEliminacion();
}

function cancelarEliminacion() {
    perfilAEliminar = null;
    document.getElementById('modalConfirmacion').style.display = 'none';
}

async function eliminarPerfil(idPerfil) {
    try {
        const respuesta = await fetch(`${API_BASE_URL}/perfiles/${idPerfil}`, {
            method: 'DELETE'
        });

        if (respuesta.ok) {
            mostrarMensaje('✅ Usuario eliminado exitosamente!', 'success');
            cargarPerfiles();
        } else {
            const error = await respuesta.json();
            mostrarMensaje('❌ Error: ' + error.error, 'error');
        }
    } catch (error) {
        mostrarMensaje('❌ Error de conexión con el servidor', 'error');
    }
}

function cerrarModal() {
    document.getElementById('modalEditar').style.display = 'none';
    document.getElementById('modalDetalles').style.display = 'none';
    perfilEditando = null;
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        sessionStorage.removeItem('esAdministrador');
        sessionStorage.removeItem('usuarioActual');
        window.location.href = '/';
    }
}

function mostrarMensaje(mensaje, tipo) {
    const mensajesAnteriores = document.querySelectorAll('.mensaje-flotante');
    mensajesAnteriores.forEach(msg => msg.remove());

    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje-flotante ${tipo}`;
    mensajeDiv.textContent = mensaje;
    mensajeDiv.style.cssText = `
        position: fixed;
        top: 25px;
        right: 25px;
        padding: 16px 24px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        ${tipo === 'success' ? 'background: linear-gradient(135deg, #48bb78, #38a169);' : 'background: linear-gradient(135deg, #f56565, #e53e3e);'}
    `;

    document.body.appendChild(mensajeDiv);

    setTimeout(() => {
        mensajeDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            mensajeDiv.remove();
        }, 300);
    }, 3000);
}



// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            if (modal.id === 'modalConfirmacion') {
                cancelarEliminacion();
            } else {
                cerrarModal();
            }
        }
    });
}

// Agregar estilos CSS para las animaciones si no existen
if (!document.querySelector('#mensaje-styles')) {
    const style = document.createElement('style');
    style.id = 'mensaje-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
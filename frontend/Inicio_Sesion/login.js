const API_BASE_URL = 'http://localhost:5000';

async function iniciarSesion() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        mostrarMensaje('❌ Por favor complete todos los campos.', 'error');
        return;
    }

    try {
        // ✅ USAR FORM DATA COMO EL BACKEND ESPERA
        const formData = new FormData();
        formData.append('email', email);
        formData.append('contraseña', password);

        const respuesta = await fetch(`${API_BASE_URL}/perfiles/login`, {
            method: 'POST',
            body: formData
        });

        if (respuesta.ok) {
            const resultado = await respuesta.json();
            
            // ✅ VERIFICAR SI EL LOGIN FUE EXITOSO
            if (resultado.id) {
                mostrarMensaje('✅ ¡Inicio de sesión exitoso!', 'success');
                
                setTimeout(() => {
                    window.location.href = `/Pagina_principal/principal.html?usuario_id=${resultado.id}`;
                }, 1000);
            } else {
                mostrarMensaje('❌ Error: No se recibió ID de usuario', 'error');
            }
        } else {
            const error = await respuesta.json();
            mostrarMensaje(`❌ ${error.error}`, 'error');
        }
    } catch (error) {
        mostrarMensaje('❌ Error de conexión: ' + error.message, 'error');
    }
}

function accesoAdministrador() {
    document.getElementById('modalAdmin').style.display = 'block';
}

async function validarAdmin() {
    const usuario = document.getElementById('adminUser').value;
    const password = document.getElementById('adminPassword').value;

    if (usuario === 'admin' && password === 'admin123') {
        try {
            // ✅ USAR FORM DATA
            const formData = new FormData();
            formData.append('usuario', usuario);
            formData.append('password', password);

            const respuesta = await fetch(`${API_BASE_URL}/admin/accesos`, {
                method: 'POST',
                body: formData
            });

            if (respuesta.ok) {
                const resultado = await respuesta.json();
                if (resultado.es_admin) {
                    // ✅ GUARDAR EN SESSION STORAGE
                    sessionStorage.setItem('esAdministrador', 'true');
                    sessionStorage.setItem('usuarioActual', JSON.stringify({ nombre: 'Administrador' }));

                    mostrarMensaje('✅ Bienvenido, Administrador.', 'success');
                    setTimeout(() => {
                        window.location.href = '/Panel_De_Administrador/index.html';
                    }, 1000);
                } else {
                    mostrarMensaje('❌ Error: No se recibió confirmación de administrador', 'error');
                }
            } else {
                const error = await respuesta.json();
                mostrarMensaje(`❌ ${error.error}`, 'error');
            }
        } catch (error) {
            mostrarMensaje('❌ Error al registrar acceso de administrador', 'error');
        }
    } else {
        mostrarMensaje('❌ Credenciales de administrador incorrectas.', 'error');
    }
}

function mostrarRegistro() {
    document.getElementById('modalRegistro').style.display = 'block';
}

function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
    document.getElementById('registroForm').reset();
}

function cerrarModalAdmin() {
    document.getElementById('modalAdmin').style.display = 'none';
    document.getElementById('adminUser').value = 'admin';
    document.getElementById('adminPassword').value = 'admin123';
}

async function registrarUsuario() {
    const nombre = document.getElementById('nombreCompleto').value.trim();
    const email = document.getElementById('emailRegistro').value.trim();
    const password = document.getElementById('passwordRegistro').value;
    const confirmPassword = document.getElementById('confirmPasswordRegistro').value;

    if (!nombre || !email || !password || !confirmPassword) {
        mostrarMensaje('❌ Por favor complete todos los campos.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        mostrarMensaje('❌ Las contraseñas no coinciden.', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarMensaje('❌ Por favor ingrese un email válido.', 'error');
        return;
    }

    if (password.length < 6) {
        mostrarMensaje('❌ La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    try {
        // ✅ USAR FORM DATA PARA REGISTRO
        const formData = new FormData();
        formData.append('nombre', nombre);
        formData.append('email', email);
        formData.append('contraseña', password);

        const response = await fetch(`${API_BASE_URL}/perfiles`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const resultado = await response.json();
            
            if (resultado.id) {
                mostrarMensaje('✅ ¡Cuenta creada exitosamente! Redirigiendo...', 'success');
                
                setTimeout(() => {
                    cerrarModal();
                    window.location.href = `../Pagina_principal/principal.html?usuario_id=${resultado.id}`;
                }, 1500);
            } else {
                mostrarMensaje('❌ Error: No se recibió ID de usuario', 'error');
            }
        } else {
            const error = await response.json();
            mostrarMensaje(`❌ Error: ${error.error}`, 'error');
        }
    } catch (error) {
        mostrarMensaje('❌ Error de conexión con el servidor', 'error');
    }
}

function mostrarMensaje(mensaje, tipo) {
    const mensajesAnteriores = document.querySelectorAll('.mensaje');
    mensajesAnteriores.forEach(msg => msg.remove());

    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje ${tipo}`;
    mensajeDiv.textContent = mensaje;

    document.body.appendChild(mensajeDiv);

    setTimeout(() => {
        mensajeDiv.remove();
    }, 3000);
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const modalRegistro = document.getElementById('modalRegistro');
    const modalAdmin = document.getElementById('modalAdmin');
    
    if (event.target === modalRegistro) {
        cerrarModal();
    }
    if (event.target === modalAdmin) {
        cerrarModalAdmin();
    }
}

// Enter para iniciar sesión
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sistema de login con FormData - Compatible con backend');
    
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            iniciarSesion();
        }
    });
    
    document.getElementById('confirmPasswordRegistro').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            registrarUsuario();
        }
    });
    
    document.getElementById('adminPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            validarAdmin();
        }
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
        document.getElementById('email').value = emailParam;
    }
    
    document.getElementById('adminUser').value = 'admin';
    document.getElementById('adminPassword').value = 'admin123';
});
const API_BASE_URL = 'http://localhost:5000';

// Usuario actual en sesión
let usuarioActual = null;

async function iniciarSesion() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        mostrarMensaje('❌ Por favor complete todos los campos.', 'error');
        return;
    }

    try {
        // ✅ NUEVO - Login con contraseña
        const respuesta = await fetch(`${API_BASE_URL}/perfiles/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                contraseña: password
            })
        });

        if (respuesta.ok) {
            const usuario = await respuesta.json();
            
            // Guardar usuario en sesión
            usuarioActual = usuario;
            localStorage.setItem('usuarioActual', JSON.stringify(usuario));
            
            mostrarMensaje('✅ ¡Inicio de sesión exitoso!', 'success');
            
            setTimeout(() => {
                // Redirigir a página principal
                window.location.href = '../Pagina_principal/principal.html';
            }, 1000);
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

function validarAdmin() {
    const usuario = document.getElementById('adminUser').value;
    const password = document.getElementById('adminPassword').value;

    if (usuario === 'admin' && password === 'admin123') {
        // Establecer bandera de administrador
        sessionStorage.setItem('esAdministrador', 'true');
        sessionStorage.setItem('usuarioActual', JSON.stringify({
            nombre: 'Administrador',
            email: 'admin@habitos.com',
            esAdmin: true
        }));
        
        mostrarMensaje('✅ Bienvenido, Administrador.', 'success');
        setTimeout(() => {
            window.location.href = '../Panel_De_Administrador/index.html';
        }, 1000);
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

    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
        mostrarMensaje('❌ Las contraseñas no coinciden.', 'error');
        return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarMensaje('❌ Por favor ingrese un email válido.', 'error');
        return;
    }

    // Validar fortaleza de contraseña
    if (password.length < 6) {
        mostrarMensaje('❌ La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/perfiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nombre: nombre,
                email: email,
                contraseña: password,
                habitos_programados: [],
                historial_habitos: []
            })
        });

        if (response.ok) {
            const nuevoPerfil = await response.json();
            
            // Guardar usuario en sesión inmediatamente después del registro
            usuarioActual = nuevoPerfil;
            localStorage.setItem('usuarioActual', JSON.stringify(nuevoPerfil));
            
            mostrarMensaje('✅ ¡Cuenta creada exitosamente! Redirigiendo...', 'success');
            
            setTimeout(() => {
                cerrarModal();
                window.location.href = '../Pagina_principal/principal.html';
            }, 1500);
            
        } else {
            const error = await response.json();
            mostrarMensaje(`❌ Error: ${error.error}`, 'error');
        }
    } catch (error) {
        mostrarMensaje('❌ Error de conexión con el servidor', 'error');
    }
}

function mostrarMensaje(mensaje, tipo) {
    // Remover mensajes anteriores
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
    console.log('Sistema de login mejorado inicializado');
    
    // Enter en campos de login
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            iniciarSesion();
        }
    });
    
    // Enter en campos de registro
    document.getElementById('confirmPasswordRegistro').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            registrarUsuario();
        }
    });
    
    // Enter en campos de admin
    document.getElementById('adminPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            validarAdmin();
        }
    });
    
    // Verificar si hay usuario en localStorage y auto-completar
    const usuarioGuardado = localStorage.getItem('usuarioActual');
    if (usuarioGuardado) {
        const usuario = JSON.parse(usuarioGuardado);
        document.getElementById('email').value = usuario.email;
    }
    
    // Configurar valores por defecto para admin
    document.getElementById('adminUser').value = 'admin';
    document.getElementById('adminPassword').value = 'admin123';
});
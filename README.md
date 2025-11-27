[README.md](https://github.com/user-attachments/files/23784141/README.md)
# Hábitos Saludables - Integración Backend

## Integrantes:
- [Junior Quispe Aquino]
- [Joacim huanca Asto] 
- [Yan Pool Barreto Recuay ]
- [Michelangelo Vasquez Salazar]

## ¿Qué es Hábitos Saludables?
Es una aplicación web fácil de usar que te ayuda a crear y mantener hábitos saludables en tu vida diaria. Como tu asistente personal, te recuerda cuándo es momento de realizar tus actividades programadas.
## Nueva Funcionalidad:
Ahora tu información se guarda de forma segura en internet, no solo en tu computadora. Esto significa que: 
- Puedes cerrar sesión y tus hábitos no se perderán
- Tus logros e historial quedan guardados para siempre
- uedes acceder desde cualquier dispositivo

## Guía de Instalación PASO a PASO con Visual Studio Code

## PASO 1: Descargar e Instalar Visual Studio Code

- Ve a: code.visualstudio.com
- Haz clic en "Download for Windows" (o tu sistema operativo)
- Ejecuta el instalador y sigue estos pasos:

✅ Marca "Add to PATH"

✅ Marca "Register Code as an editor for supported file types"

✅ Marca "Add to Context Menu"

Sigue las instrucciones del instalador

## PASO 2: Instalar Python (si no lo tienes)

- En VS Code, ve a Extensions (Ctrl+Shift+X)
- Busca "Python" y instala la extensión de Microsoft
- La extensión te guiará para instalar Python si es necesario

## O instala manualmente:

- Ve a: python.org/downloads
- Descarga Python 3.11+ y ejecuta el instalador
- MARCA "Add Python to PATH"

## PASO 3: Abrir el Proyecto en VS Code
- Abre Visual Studio Code
- Ve a File → Open Folder (Archivo → Abrir carpeta)
- Selecciona la carpeta completa de tu proyecto
- Haz clic en "Select Folder"
- Seleccionas el folder de la app
- luego Veras al lado izquierdo: 
📁 tu-proyecto/
 ├── 📁 backend/
 ├── 📁 frontend/
 ├── 🗄️ mi_app_db.sql  (base de datos SQL)
 └── 📄 README.md
## PASO 4: Instalar Dependencias desde VS Code
- En VS Code, ve a Terminal → New Terminal (Terminal → Nueva Terminal)
- En la terminal inferior, ejecuta:
   - cd backend
   - pip install psycopg2-binary python-dotenv
   - pip install -r requirements.txt
   - python app.py

 ✅ Debes ver en la terminal:
Servidor backend iniciado en http://localhost:5000
* Running on http://127.0.0.1:5000

⚠️ IMPORTANTE: Mantén esta terminal ABIERTA mientras uses la aplicación

## PASO 5: Abrir el Frontend desde VS Code
- En el explorador de VS Code (lado izquierdo)
- Abre la carpeta frontend → Inicio_Sesion
- Haz clic derecho en login.html
- Selecciona "Open with Live Server"
O
- Haz clic derecho → "Copy Path" y pégalo en tu navegador

¡La aplicación se abrirá en tu navegador!

## 🔐 Cómo Empezar a Usarla
Opción 1: Crear Cuenta Nueva

- En la aplicación web, haz clic en "Regístrate aquí"
- Llena tus datos:
  - Nombre completo: Ej: "María García"
  - Correo electrónico: Ej: "maria@ejemplo.com"
  - Contraseña: (mínimo 6 caracteres)
  - Haz clic en "Crear Cuenta"

Opción 2: Usar Modo Administrador (Para probar)

- Haz clic en "Acceso Administrador"
- Usa estas credenciales:
    Usuario: admin
    Contraseña: admin123

## 📱 Guía de Uso de la Aplicación
🏠 Pantalla Principal

⏰ Reloj: Muestra la hora actual - puedes cambiarla
👤 Mi Perfil: Ve tu información y estadísticas

➕ Agregar Hábito: Crea nuevos recordatorios
📝 Mis Hábitos: Lista de tus actividades programadas
📊 Historial: Registro de lo que has completado

📅 Cómo Crear un Hábito
En "Agregar hábito", escribe: Ej: "Beber agua"
Selecciona una hora: Ej: 08:00 AM
Haz clic en "Agregar"
✨ ¡Listo! La aplicación te recordará a esa hora todos los días.

🔔 Cuando Suena la Alarma

⏰ Aparece un mensaje en pantalla
🔊 Suena un sonido de recordatorio
Tienes dos opciones:
✅ "Detener alarma" - Si cumpliste el hábito
⏳ Esperar 10 segundos - Si no lo cumpliste

## LISTA DE ENDPOINTS IMPLEMENTADOS

Método	URL                                 	   ¿Qué hace?
GET	    http://localhost:5000/health	          Verifica que el servidor funcione
POST	   http://localhost:5000/perfiles	        Crear nuevo usuario
GET     http://localhost:5000/perfiles	        Ver todos los usuarios
GET	    http://localhost:5000/perfiles/123	    Ver usuario específico
PUT  	  http://localhost:5000/perfiles/123	    Actualizar usuario
DELETE	 http://localhost:5000/perfiles/123	    Eliminar usuario
POST	   http://localhost:5000/perfiles/login	  Iniciar sesión

## 📁 Estructura de Carpetas (Cómo Está Organizado)

📁 Hábitos_Saludables/
├── 🗄️ database/               (Base de datos del proyecto)
│   └── mi_app_db.sql          (Script SQL para crear la base de datos)
│
├── 🔧 backend/                (El cerebro - guarda la información)
│   ├── .env                   (Variables de entorno)
│   ├── app.py                 (Programa principal del servidor)
│   └── requirements.txt       (Lista de herramientas necesarias)
│
└── 🎨 frontend/               (Lo que ves - interfaz bonita)
    ├── Inicio_Sesion/         (Pantalla de login y registro)
    │   ├── login.html         (Página principal de entrada)
    │   ├── login.css          (Diseño y colores)
    │   └── login.js           (Funciones de login)
    │
    ├── Pagina_principal/      (App principal de hábitos)
    │   ├── principal.html     (Pantalla con reloj y hábitos)
    │   ├── principal.css      (Estilos y diseño)
    │   ├── principal.js       (Lógica de la aplicación)
    │   └── alarma.mp3         (Sonido de recordatorio)
    │
    └── Panel_De_Administrador/ (Para gestionar usuarios)
        ├── index.html         (Panel de control)
        ├── admin.css          (Diseño del panel)
        └── admin.js           (Funciones de administración)
│
└── 📄 README.md               (Guía y documentación del proyecto)


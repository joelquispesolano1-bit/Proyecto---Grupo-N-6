# ----------------------------
# IMPORTS Y CONFIGURACIÓN GLOBAL
# ----------------------------
import logging
import os
from datetime import datetime
from dotenv import load_dotenv

# Flask app imports
from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt
from flask import send_from_directory

# MySQL imports
import mysql.connector
from mysql.connector import Error

# Logging único para todo el archivo
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("app_mysql")

# Cargar .env
load_dotenv()

# ----------------------------
# CONSTANTES (MySQL)
# ----------------------------
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "mi_app_db")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Campos requeridos para el API Flask
CAMPOS_PERFIL_REQUERIDOS = ['nombre', 'email', 'contraseña']

# ----------------------------
# CONEXIÓN Y GESTIÓN MYSQL
# ----------------------------

def get_conn():
    """Obtener conexión a MariaDB/MySQL con manejo mejorado"""
    try:
        connection_params = {
            'host': DB_HOST,
            'port': int(DB_PORT),
            'database': DB_NAME,
            'user': DB_USER,
        }
        
        # Solo agregar password si no está vacío
        if DB_PASSWORD and DB_PASSWORD.strip():
            connection_params['password'] = DB_PASSWORD
        
        # Forzar autenticación nativa para MariaDB
        connection_params['auth_plugin'] = 'mysql_native_password'
        
        conn = mysql.connector.connect(**connection_params)
        logger.info("✅ Conexión a MariaDB/MySQL exitosa")
        return conn
        
    except Error as e:
        logger.error(f"❌ Error conectando a MariaDB/MySQL: {e}")
        logger.error(f"   Parámetros: host={DB_HOST}, port={DB_PORT}, db={DB_NAME}, user={DB_USER}")
        raise

# ----------------------------
# PARTE 2: API FLASK CON MYSQL (SIN JSON)
# ----------------------------

app = Flask(__name__)
CORS(app)

class GestorPerfiles:
    """Clase optimizada para gestión de perfiles con MySQL"""

    @staticmethod
    def cargar_perfiles():
        """Cargar todos los perfiles desde MySQL"""
        try:
            conn = get_conn()
            cursor = conn.cursor(dictionary=True)
            
            # Cargar perfiles
            cursor.execute("SELECT * FROM perfiles")
            perfiles = cursor.fetchall()
            
            # Para cada perfil, cargar sus hábitos
            for perfil in perfiles:
                # Hábitos programados
                cursor.execute(
                    "SELECT * FROM habitos_programados WHERE perfil_id = %s",
                    (perfil['id'],)
                )
                perfil['habitos_programados'] = cursor.fetchall()
                
                # Historial de hábitos
                cursor.execute(
                    "SELECT * FROM habitos_historial WHERE perfil_id = %s", 
                    (perfil['id'],)
                )
                perfil['historial_habitos'] = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return perfiles
        except Error as e:
            logger.error(f"❌ Error cargando perfiles desde MySQL: {e}")
            return []

    @staticmethod
    def guardar_perfil(perfil):
        """Guardar un perfil en MySQL (crear o actualizar)"""
        try:
            conn = get_conn()
            cursor = conn.cursor()
            
            # Insertar o actualizar perfil (usando 'password' en SQL)
            cursor.execute("""
                INSERT INTO perfiles (id, nombre, email, password, fecha_creacion)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    email = VALUES(email),
                    password = VALUES(password),
                    fecha_creacion = VALUES(fecha_creacion)
            """, (
                perfil['id'], perfil['nombre'], perfil['email'], 
                perfil['contraseña'], perfil.get('fecha_creacion')
            ))
            
            # Eliminar hábitos existentes y guardar nuevos
            if 'habitos_programados' in perfil:
                cursor.execute(
                    "DELETE FROM habitos_programados WHERE perfil_id = %s",
                    (perfil['id'],)
                )
                for habito in perfil['habitos_programados']:
                    cursor.execute("""
                        INSERT INTO habitos_programados 
                        (id, perfil_id, nombre, hora, categoria, activo)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        habito['id'], perfil['id'], habito['nombre'],
                        habito['hora'], habito.get('categoria'), 
                        habito.get('activo', True)
                    ))
            
            if 'historial_habitos' in perfil:
                cursor.execute(
                    "DELETE FROM habitos_historial WHERE perfil_id = %s",
                    (perfil['id'],)
                )
                for habito in perfil['historial_habitos']:
                    cursor.execute("""
                        INSERT INTO habitos_historial 
                        (id, perfil_id, nombre, hora, estado, fecha)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        habito['id'], perfil['id'], habito['nombre'],
                        habito['hora'], habito['estado'], habito.get('fecha')
                    ))
            
            conn.commit()
            cursor.close()
            conn.close()
            return True
            
        except Error as e:
            logger.error(f"❌ Error guardando perfil en MySQL: {e}")
            if conn:
                conn.rollback()
                conn.close()
            return False

    @staticmethod
    def eliminar_perfil(id_perfil):
        """Eliminar perfil de MySQL (con CASCADE elimina también sus hábitos)"""
        try:
            conn = get_conn()
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM perfiles WHERE id = %s", (id_perfil,))
            conn.commit()
            
            cursor.close()
            conn.close()
            return cursor.rowcount > 0
            
        except Error as e:
            logger.error(f"❌ Error eliminando perfil: {e}")
            if conn:
                conn.rollback()
                conn.close()
            return False

    @staticmethod
    def generar_id():
        """Generar ID único"""
        return str(int(datetime.now().timestamp()))

    @staticmethod
    def cifrar_contraseña(contraseña_plana):
        """Cifrar contraseña usando bcrypt"""
        try:
            salt = bcrypt.gensalt()
            return bcrypt.hashpw(contraseña_plana.encode('utf-8'), salt).decode('utf-8')
        except Exception as error:
            logger.error(f"❌ Error cifrando contraseña: {error}")
            return None

    @staticmethod
    def verificar_contraseña(contraseña_plana, contraseña_cifrada):
        """Verificar contraseña cifrada"""
        try:
            return bcrypt.checkpw(contraseña_plana.encode('utf-8'), contraseña_cifrada.encode('utf-8'))
        except Exception as error:
            logger.error(f"❌ Error verificando contraseña: {error}")
            return False

    @staticmethod
    def validar_datos_perfil(datos_perfil):
        """Validar datos del perfil"""
        for campo in CAMPOS_PERFIL_REQUERIDOS:
            if not datos_perfil.get(campo):
                return False, f"Campo requerido faltante: {campo}"
        return True, "Datos válidos"

    @staticmethod
    def es_email_duplicado(email_a_verificar, id_perfil_excluir=None):
        """Verificar si el email ya está registrado en MySQL"""
        try:
            conn = get_conn()
            cursor = conn.cursor()
            
            if id_perfil_excluir:
                cursor.execute(
                    "SELECT id FROM perfiles WHERE email = %s AND id != %s",
                    (email_a_verificar, id_perfil_excluir)
                )
            else:
                cursor.execute(
                    "SELECT id FROM perfiles WHERE email = %s", 
                    (email_a_verificar,)
                )
            
            resultado = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return resultado is not None
            
        except Error as e:
            logger.error(f"❌ Error verificando email duplicado: {e}")
            return False

    @staticmethod
    def buscar_perfil_por_id(id_perfil):
        """Encontrar perfil por ID en MySQL"""
        try:
            conn = get_conn()
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute("SELECT * FROM perfiles WHERE id = %s", (id_perfil,))
            perfil = cursor.fetchone()
            
            if perfil:
                # Cargar hábitos programados
                cursor.execute(
                    "SELECT * FROM habitos_programados WHERE perfil_id = %s",
                    (id_perfil,)
                )
                perfil['habitos_programados'] = cursor.fetchall()
                
                # Cargar historial de hábitos
                cursor.execute(
                    "SELECT * FROM habitos_historial WHERE perfil_id = %s", 
                    (id_perfil,)
                )
                perfil['historial_habitos'] = cursor.fetchall()
            
            cursor.close()
            conn.close()
            return perfil
            
        except Error as e:
            logger.error(f"❌ Error buscando perfil por ID: {e}")
            return None

    @staticmethod
    def crear_perfil_seguro(perfil):
        """Crear copia segura del perfil sin contraseña"""
        if perfil is None:
            return None
        perfil_seguro = perfil.copy()
        perfil_seguro.pop('contraseña', None)
        return perfil_seguro



# Helper responses
def respuesta_error(mensaje, codigo=400):
    return jsonify({'error': mensaje}), codigo

def respuesta_exitosa(datos, codigo=200):
    return jsonify(datos), codigo

# ----------------------------
# ENDPOINTS ACTUALIZADOS (SOLO FORM DATA)
# ----------------------------

@app.route('/perfiles', methods=['POST'])
def crear_perfil():
    """Endpoint para crear nuevo perfil - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form

        # Validar campos requeridos
        es_valido, mensaje_validacion = GestorPerfiles.validar_datos_perfil(datos_solicitud)
        if not es_valido:
            return respuesta_error(mensaje_validacion)

        # Validar email único
        if GestorPerfiles.es_email_duplicado(datos_solicitud['email']):
            return respuesta_error('El email ya está registrado')

        # Cifrar contraseña
        contraseña_cifrada = GestorPerfiles.cifrar_contraseña(datos_solicitud['contraseña'])
        if not contraseña_cifrada:
            return respuesta_error('Error procesando contraseña', 500)

        # Crear nuevo perfil
        nuevo_perfil = {
            'id': GestorPerfiles.generar_id(),
            'nombre': datos_solicitud['nombre'],
            'email': datos_solicitud['email'],
            'contraseña': contraseña_cifrada,
            'habitos_programados': [],
            'historial_habitos': [],
            'fecha_creacion': datetime.now().isoformat()
        }

        if GestorPerfiles.guardar_perfil(nuevo_perfil):
            logger.info(f"✅ Perfil creado: {nuevo_perfil['email']}")
            return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(nuevo_perfil), 201)
        else:
            return respuesta_error('Error guardando perfil', 500)

    except Exception as error:
        logger.error(f"❌ Error inesperado creando perfil: {error}")
        return respuesta_error('Error interno del servidor', 500)

@app.route('/perfiles', methods=['GET'])
def listar_todos_perfiles():
    """Endpoint para listar todos los perfiles"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfiles_seguros = [GestorPerfiles.crear_perfil_seguro(perfil) for perfil in todos_perfiles]
        return respuesta_exitosa(perfiles_seguros)
    except Exception as error:
        logger.error(f"❌ Error listando perfiles: {error}")
        return respuesta_error('Error obteniendo perfiles', 500)

@app.route('/perfiles/<string:id_perfil>', methods=['GET'])
def obtener_perfil_especifico(id_perfil):
    """Endpoint para obtener un perfil específico"""
    try:
        perfil_objetivo = GestorPerfiles.buscar_perfil_por_id(id_perfil)

        if not perfil_objetivo:
            return respuesta_error('Perfil no encontrado', 404)

        return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(perfil_objetivo))
    except Exception as error:
        logger.error(f"❌ Error obteniendo perfil {id_perfil}: {error}")
        return respuesta_error('Error obteniendo perfil', 500)

@app.route('/perfiles/<string:id_perfil>', methods=['PUT'])
def actualizar_perfil_existente(id_perfil):
    """Endpoint para actualizar un perfil existente - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form

        perfil_actual = GestorPerfiles.buscar_perfil_por_id(id_perfil)
        if not perfil_actual:
            return respuesta_error('Perfil no encontrado', 404)

        # Actualizar campos permitidos
        campos_actualizables = ['nombre']
        for campo in campos_actualizables:
            if campo in datos_solicitud:
                perfil_actual[campo] = datos_solicitud[campo]

        # Validar y actualizar email si es necesario
        if 'email' in datos_solicitud and datos_solicitud['email'] != perfil_actual['email']:
            if GestorPerfiles.es_email_duplicado(datos_solicitud['email'], id_perfil):
                return respuesta_error('El email ya está en uso')
            perfil_actual['email'] = datos_solicitud['email']

        # Actualizar contraseña si se proporciona
        if 'contraseña' in datos_solicitud and datos_solicitud['contraseña']:
            contraseña_cifrada = GestorPerfiles.cifrar_contraseña(datos_solicitud['contraseña'])
            if contraseña_cifrada:
                perfil_actual['contraseña'] = contraseña_cifrada

        if GestorPerfiles.guardar_perfil(perfil_actual):
            logger.info(f"✅ Perfil actualizado: {id_perfil}")
            return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(perfil_actual))
        else:
            return respuesta_error('Error guardando cambios', 500)

    except Exception as error:
        logger.error(f"❌ Error actualizando perfil {id_perfil}: {error}")
        return respuesta_error('Error actualizando perfil', 500)





@app.route('/perfiles/<string:id_perfil>', methods=['DELETE'])
def eliminar_perfil(id_perfil):
    """Endpoint para eliminar un perfil"""
    try:
        if GestorPerfiles.eliminar_perfil(id_perfil):
            logger.info(f"✅ Perfil eliminado: {id_perfil}")
            return respuesta_exitosa({'mensaje': 'Perfil eliminado correctamente'})
        else:
            return respuesta_error('Perfil no encontrado', 404)

    except Exception as error:
        logger.error(f"❌ Error eliminando perfil {id_perfil}: {error}")
        return respuesta_error('Error eliminando perfil', 500)

@app.route('/perfiles/login', methods=['POST'])
def login_usuario():
    """Endpoint para login de usuario - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form

        email = datos_solicitud.get('email')
        contraseña = datos_solicitud.get('contraseña')

        if not email or not contraseña:
            return respuesta_error('Email y contraseña requeridos')

        # Buscar perfil por email
        try:
            conn = get_conn()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM perfiles WHERE email = %s", (email,))
            perfil = cursor.fetchone()
            cursor.close()
            conn.close()
        except Error as e:
            logger.error(f"❌ Error buscando perfil para login: {e}")
            return respuesta_error('Error en el servidor', 500)

        if not perfil:
            return respuesta_error('Usuario no encontrado', 404)

        # Verificar contraseña
        if not GestorPerfiles.verificar_contraseña(contraseña, perfil['password']):
            return respuesta_error('Contraseña incorrecta', 401)

        # Cargar hábitos del usuario
        perfil_completo = GestorPerfiles.buscar_perfil_por_id(perfil['id'])

        logger.info(f"✅ Login exitoso: {perfil['email']}")
        return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(perfil_completo))

    except Exception as error:
        logger.error(f"❌ Error en login: {error}")
        return respuesta_error('Error en el servidor', 500)

@app.route('/admin/accesos', methods=['POST'])
def acceso_administrador():
    """Endpoint para acceso de administrador - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form
        
        usuario = datos_solicitud.get('usuario')
        password = datos_solicitud.get('password')
        
        # Validar credenciales de administrador
        if usuario == 'admin' and password == 'admin123':
            logger.info("✅ Acceso de administrador exitoso")
            return respuesta_exitosa({
                'mensaje': 'Acceso de administrador exitoso',
                'es_admin': True
            })
        else:
            return respuesta_error('Credenciales de administrador incorrectas', 401)
            
    except Exception as error:
        logger.error(f"❌ Error en acceso de administrador: {error}")
        return respuesta_error('Error en el servidor', 500)

# ✅ ENDPOINTS PARA HÁBITOS E HISTORIAL - FORM DATA
@app.route('/habitos/obtener/<string:usuario_id>', methods=['GET'])
def obtener_habitos_usuario(usuario_id):
    """Obtener hábitos de un usuario específico"""
    try:
        perfil = GestorPerfiles.buscar_perfil_por_id(usuario_id)
        if not perfil:
            return respuesta_error('Usuario no encontrado', 404)
        
        return respuesta_exitosa({'habitos': perfil.get('habitos_programados', [])})
    except Exception as error:
        logger.error(f"❌ Error obteniendo hábitos: {error}")
        return respuesta_error('Error obteniendo hábitos', 500)

@app.route('/habitos/guardar', methods=['POST'])
def guardar_habito():
    """Guardar hábito para un usuario - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form
        
        usuario_id = datos_solicitud.get('usuario_id')
        nombre = datos_solicitud.get('nombre')
        hora = datos_solicitud.get('hora')
        activo = datos_solicitud.get('activo', 'true')
        
        if not all([usuario_id, nombre, hora]):
            return respuesta_error('Usuario ID, nombre y hora son requeridos')
        
        perfil = GestorPerfiles.buscar_perfil_por_id(usuario_id)
        if not perfil:
            return respuesta_error('Usuario no encontrado', 404)
        
        nuevo_habito = {
            'id': GestorPerfiles.generar_id(),
            'nombre': nombre,
            'hora': hora,
            'categoria': 'salud',
            'activo': activo.lower() == 'true'
        }
        
        if GestorPerfiles.agregar_habito_programado(usuario_id, nuevo_habito):
            return respuesta_exitosa(nuevo_habito, 201)
        else:
            return respuesta_error('Error guardando hábito', 500)
            
    except Exception as error:
        logger.error(f"❌ Error guardando hábito: {error}")
        return respuesta_error('Error guardando hábito', 500)

@app.route('/habitos/eliminar', methods=['DELETE'])
def eliminar_habito():
    """Eliminar hábito - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form
        
        usuario_id = datos_solicitud.get('usuario_id')
        habito_id = datos_solicitud.get('habito_id')
        
        if not all([usuario_id, habito_id]):
            return respuesta_error('Usuario ID y Hábito ID son requeridos')
        
        # Eliminar hábito específico
        try:
            conn = get_conn()
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM habitos_programados WHERE perfil_id = %s AND id = %s",
                (usuario_id, habito_id)
            )
            conn.commit()
            cursor.close()
            conn.close()
            
            if cursor.rowcount > 0:
                return respuesta_exitosa({'mensaje': 'Hábito eliminado correctamente'})
            else:
                return respuesta_error('Hábito no encontrado', 404)
                
        except Error as e:
            logger.error(f"❌ Error eliminando hábito: {e}")
            return respuesta_error('Error eliminando hábito', 500)
            
    except Exception as error:
        logger.error(f"❌ Error eliminando hábito: {error}")
        return respuesta_error('Error eliminando hábito', 500)

@app.route('/historial/obtener/<string:usuario_id>', methods=['GET'])
def obtener_historial_usuario(usuario_id):
    """Obtener historial de un usuario específico"""
    try:
        perfil = GestorPerfiles.buscar_perfil_por_id(usuario_id)
        if not perfil:
            return respuesta_error('Usuario no encontrado', 404)
        
        return respuesta_exitosa({'historial': perfil.get('historial_habitos', [])})
    except Exception as error:
        logger.error(f"❌ Error obteniendo historial: {error}")
        return respuesta_error('Error obteniendo historial', 500)

@app.route('/historial/guardar', methods=['POST'])
def guardar_historial():
    """Guardar actividad en historial - FORM DATA"""
    try:
        # ✅ USAR FORM DATA EN LUGAR DE JSON
        datos_solicitud = request.form

        usuario_id = datos_solicitud.get('usuario_id')
        habito_id = datos_solicitud.get('habito_id')
        nombre = datos_solicitud.get('nombre')
        hora = datos_solicitud.get('hora')
        estado = datos_solicitud.get('estado')

        if not all([usuario_id, habito_id, nombre, hora, estado]):
            return respuesta_error('Todos los campos son requeridos')

        perfil = GestorPerfiles.buscar_perfil_por_id(usuario_id)
        if not perfil:
            return respuesta_error('Usuario no encontrado', 404)

        nueva_actividad = {
            'id': GestorPerfiles.generar_id(),
            'nombre': nombre,
            'hora': hora,
            'estado': estado,
            'fecha': datetime.now().isoformat()
        }

        # ✅ ELIMINAR EL HÁBITO DE HABITOS_PROGRAMADOS CUANDO SE COMPLETA (SOLO SI NO ES REPETIBLE)
        if estado == 'completado':
            logger.info(f"🔍 Verificando eliminación de hábito completado: {nombre} (ID: {habito_id}) para usuario {usuario_id}")

            try:
                conn = get_conn()
                cursor = conn.cursor()

                # Cargar el hábito específico desde la base de datos
                cursor.execute(
                    "SELECT id, nombre, hora, activo FROM habitos_programados WHERE perfil_id = %s AND id = %s",
                    (usuario_id, habito_id)
                )
                habito_db = cursor.fetchone()

                logger.info(f"   Hábito encontrado en DB: {habito_db}")

                if habito_db:
                    activo = habito_db['activo']
                    logger.info(f"   Campo 'activo': {activo}")

                    # Solo eliminar si el hábito NO es repetible (activo = 0)
                    if activo == 0:
                        # Verificar que existe antes de eliminar
                        cursor.execute(
                            "SELECT COUNT(*) as count FROM habitos_programados WHERE perfil_id = %s AND id = %s",
                            (usuario_id, habito_id)
                        )
                        count = cursor.fetchone()['count']
                        logger.info(f"   Registros encontrados antes de eliminar: {count}")

                        cursor.execute(
                            "DELETE FROM habitos_programados WHERE perfil_id = %s AND id = %s",
                            (usuario_id, habito_id)
                        )

                        deleted_count = cursor.rowcount
                        logger.info(f"✅ Hábito '{nombre}' (ID: {habito_id}) eliminado de programados para usuario {usuario_id}. Registros eliminados: {deleted_count}")

                        conn.commit()
                    else:
                        logger.info(f"ℹ️ Hábito '{nombre}' (ID: {habito_id}) es repetible (activo={activo}), se mantiene en programados")
                else:
                    logger.info(f"ℹ️ Hábito '{nombre}' (ID: {habito_id}) no encontrado en programados")

                cursor.close()
                conn.close()
            except Error as e:
                logger.error(f"❌ Error verificando/elimando hábito programado: {e}")
                if conn:
                    conn.close()

        if GestorPerfiles.agregar_habito_historial(usuario_id, nueva_actividad):
            return respuesta_exitosa(nueva_actividad, 201)
        else:
                return respuesta_error('Error guardando en historial', 500)

    except Exception as error:
        logger.error(f"❌ Error guardando historial: {error}")
        return respuesta_error('Error guardando historial', 500)

@app.route('/health', methods=['GET'])
def verificar_estado():
    """Endpoint para verificar el estado del servicio"""
    try:
        # Verificar conexión a la base de datos
        conn = get_conn()
        conn.close()
        db_status = "healthy"
    except Error:
        db_status = "unhealthy"

    return respuesta_exitosa({
        'status': 'healthy',
        'database': db_status,
        'service': 'Hábitos Saludables API con MySQL',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/frontend/Inicio_Sesion/<path:filename>')
def serve_static_files(filename):
    return send_from_directory('../frontend/Inicio_Sesion', filename)

@app.route('/')
def inicio():
    return send_from_directory('../frontend/Inicio_Sesion', 'login.html')

@app.route('/Pagina_principal/<path:filename>')
def pagina_principal(filename):
    return send_from_directory('../frontend/Pagina_principal', filename)

@app.route('/Panel_De_Administrador/<path:filename>')
def admin_files(filename):
    return send_from_directory('../frontend/Panel_De_Administrador', filename)

@app.route('/frontend/<path:filename>')
def servir_archivos_frontend(filename):
    frontend_path = os.path.join(os.getcwd(), 'frontend')
    return send_from_directory(frontend_path, filename)

# ----------------------------
# MAIN
# ----------------------------
def main():
    # Inicializar base de datos
    
    logger.info("🚀 Servidor backend con MySQL iniciado en http://127.0.0.1:5000")
    logger.info("📝 Modo: FormData ")
    app.run(debug=True, host='0.0.0.0', port=5000)

if __name__ == "__main__":
    main()
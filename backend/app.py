#!/usr/bin/env python3
"""
Archivo combinado: API Flask (gestión de perfiles) + Sincronizador JSON -> PostgreSQL.
Comportamiento:
 - Si se detectan argumentos del sincronizador (p.ej. --file, --watch, --prune), se ejecuta la
   funcionalidad de sync_json_to_postgres.py (idéntica a la original).
 - Si no se pasan esos argumentos, se arranca el servidor Flask (idéntico al app.py original).
No se cambió la lógica ni las funcionalidades principales de ninguno de los dos módulos.
"""

# ----------------------------
# IMPORTS Y CONFIGURACIÓN GLOBAL
# ----------------------------
import argparse
import json
import os
import time
import logging
import sys
from datetime import datetime
from dotenv import load_dotenv

# Flask app imports
from flask import Flask, request, jsonify
from flask_cors import CORS
import bcrypt

# Postgres imports (sin cambios)
import psycopg2
from psycopg2.extras import execute_values

# Logging único para todo el archivo
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("app_sync_merged")

# Cargar .env (ambos scripts lo hacían)
load_dotenv()

# ----------------------------
# CONSTANTES (unificadas)
# ----------------------------
RUTA_ARCHIVO_DATOS = os.getenv("RUTA_ARCHIVO_DATOS", "perfiles.json")

# DB envs (usadas por el sincronizador)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "mi_basedatos")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Campos requeridos para el API Flask
CAMPOS_PERFIL_REQUERIDOS = ['nombre', 'email', 'contraseña']

# ----------------------------
# PARTE 1: SINCRONIZADOR JSON -> POSTGRES (idéntico a sync_json_to_postgres.py)
# ----------------------------

def get_conn():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def load_json_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def is_int_like(s):
    try:
        int(str(s))
        return True
    except Exception:
        return False

def gen_bigint_from_timestamp():
    return int(datetime.utcnow().timestamp())

def upsert_perfiles(conn, perfiles):
    with conn.cursor() as cur:
        perfiles_rows = []
        for p in perfiles:
            pid = p.get('id')
            if pid is None:
                pid = gen_bigint_from_timestamp()
            elif is_int_like(pid):
                pid = int(pid)
            else:
                pid = gen_bigint_from_timestamp()

            nombre = p.get('nombre') or ''
            email = p.get('email') or ''
            contr = p.get('contraseña') or ''
            fecha = None
            if p.get('fecha_creacion'):
                try:
                    fecha = datetime.fromisoformat(p.get('fecha_creacion'))
                except Exception:
                    fecha = None

            perfiles_rows.append((pid, nombre, email, contr, fecha))

        if perfiles_rows:
            sql_upsert_perfiles = """
            INSERT INTO public.perfiles (id, nombre, email, contraseña, fecha_creacion)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
              nombre = EXCLUDED.nombre,
              email = EXCLUDED.email,
              contraseña = EXCLUDED.contraseña,
              fecha_creacion = COALESCE(EXCLUDED.fecha_creacion, public.perfiles.fecha_creacion)
            ;
            """
            execute_values(cur, sql_upsert_perfiles, perfiles_rows, template=None, page_size=100)
            logger.info(f"Upserted {len(perfiles_rows)} perfiles.")

        for p in perfiles:
            pid_raw = p.get('id')
            if pid_raw is None:
                pid = gen_bigint_from_timestamp()
            elif is_int_like(pid_raw):
                pid = int(pid_raw)
            else:
                pid = gen_bigint_from_timestamp()

            cur.execute("DELETE FROM public.habitos_programados WHERE perfil_id = %s", (pid,))
            cur.execute("DELETE FROM public.habitos_historial WHERE perfil_id = %s", (pid,))

            hp = p.get('habitos_programados', []) or []
            if hp:
                rows_hp = []
                for h in hp:
                    hid_raw = h.get('id')
                    if hid_raw is None:
                        hid = gen_bigint_from_timestamp()
                    elif is_int_like(hid_raw):
                        hid = int(hid_raw)
                    else:
                        hid = gen_bigint_from_timestamp()
                    nombre_h = h.get('nombre') or ''
                    hora_h = h.get('hora') or ''
                    categoria = h.get('categoria')
                    activo = bool(h.get('activo', True))
                    rows_hp.append((hid, pid, nombre_h, hora_h, categoria, activo))

                sql_hp = """
                INSERT INTO public.habitos_programados (id, perfil_id, nombre, hora, categoria, activo)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  perfil_id = EXCLUDED.perfil_id,
                  nombre = EXCLUDED.nombre,
                  hora = EXCLUDED.hora,
                  categoria = EXCLUDED.categoria,
                  activo = EXCLUDED.activo
                ;
                """
                execute_values(cur, sql_hp, rows_hp, template=None, page_size=100)

            hh = p.get('historial_habitos', []) or []
            if hh:
                rows_hh = []
                for h in hh:
                    hid_raw = h.get('id')
                    if hid_raw is None:
                        hid = gen_bigint_from_timestamp()
                    elif is_int_like(hid_raw):
                        hid = int(hid_raw)
                    else:
                        hid = gen_bigint_from_timestamp()
                    nombre_h = h.get('nombre') or ''
                    hora_h = h.get('hora') or ''
                    estado = h.get('estado') or 'no_completado'
                    fecha = None
                    if h.get('fecha'):
                        try:
                            fecha = datetime.fromisoformat(h.get('fecha'))
                        except Exception:
                            fecha = None
                    rows_hh.append((hid, pid, nombre_h, hora_h, estado, fecha))

                sql_hh = """
                INSERT INTO public.habitos_historial (id, perfil_id, nombre, hora, estado, fecha)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                  perfil_id = EXCLUDED.perfil_id,
                  nombre = EXCLUDED.nombre,
                  hora = EXCLUDED.hora,
                  estado = EXCLUDED.estado,
                  fecha = COALESCE(EXCLUDED.fecha, public.habitos_historial.fecha)
                ;
                """
                execute_values(cur, sql_hh, rows_hh, template=None, page_size=100)

    conn.commit()
    logger.info("Sincronización completada.")

def prune_profiles_not_in_json(conn, perfiles):
    ids_json = set()
    for p in perfiles:
        pid = p.get('id')
        if pid is None:
            continue
        if is_int_like(pid):
            ids_json.add(int(pid))
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM public.perfiles;")
        ids_db = set([row[0] for row in cur.fetchall()])
        to_delete = list(ids_db - ids_json)
        if to_delete:
            cur.execute("DELETE FROM public.perfiles WHERE id = ANY(%s);", (to_delete,))
            conn.commit()
            logger.info(f"Eliminados {len(to_delete)} perfiles de la BD por prune.")
            return to_delete
    return []

def sync_main(argv=None):
    """
    Main del sincronizador. Mantiene la interfaz de argparse idéntica a sync_json_to_postgres.py.
    """
    parser = argparse.ArgumentParser(description="Sincroniza perfiles.json -> PostgreSQL (limpio)")
    parser.add_argument('--file', default=RUTA_ARCHIVO_DATOS, help='Ruta al archivo JSON')
    parser.add_argument('--watch', type=int, default=0, help='Vigilar cambios cada N segundos (0 = una vez)')
    parser.add_argument('--prune', action='store_true', help='Eliminar en BD perfiles que no estén en el JSON')
    args = parser.parse_args(argv)

    if not os.path.exists(args.file):
        logger.error(f"Archivo JSON no encontrado: {args.file}")
        return

    try:
        conn = get_conn()
    except Exception as e:
        logger.exception(f"No se pudo conectar a la BD: {e}")
        return

    last_mtime = 0
    try:
        while True:
            mtime = os.path.getmtime(args.file)
            if mtime != last_mtime:
                logger.info("Detectado cambio o primera ejecución. Leyendo JSON...")
                try:
                    perfiles = load_json_file(args.file)
                except Exception as e:
                    logger.exception(f"Error leyendo JSON: {e}")
                    if args.watch <= 0:
                        break
                    time.sleep(max(1, args.watch))
                    continue

                try:
                    upsert_perfiles(conn, perfiles)
                    if args.prune:
                        prune_profiles_not_in_json(conn, perfiles)
                except Exception as e:
                    logger.exception(f"Error sincronizando a Postgres: {e}")
                    conn.rollback()

                last_mtime = mtime

            if args.watch > 0:
                time.sleep(args.watch)
            else:
                break
    except KeyboardInterrupt:
        logger.info("Interrumpido por usuario.")
    finally:
        conn.close()
        logger.info("Conexión cerrada. Fin.")

# ----------------------------
# PARTE 2: API FLASK (idéntica a app.py)
# ----------------------------

app = Flask(__name__)
CORS(app)

class GestorPerfiles:
    """Clase optimizada para gestión de perfiles"""

    @staticmethod
    def cargar_perfiles():
        """Cargar perfiles desde JSON"""
        try:
            if os.path.exists(RUTA_ARCHIVO_DATOS):
                with open(RUTA_ARCHIVO_DATOS, 'r', encoding='utf-8') as archivo:
                    return json.load(archivo)
            return []
        except (json.JSONDecodeError, IOError) as error:
            logger.error(f"Error cargando perfiles: {error}")
            return []

    @staticmethod
    def guardar_perfiles(datos_perfiles):
        """Guardar perfiles en JSON"""
        try:
            with open(RUTA_ARCHIVO_DATOS, 'w', encoding='utf-8') as archivo:
                json.dump(datos_perfiles, archivo, indent=2, ensure_ascii=False)
            return True
        except IOError as error:
            logger.error(f"Error guardando perfiles: {error}")
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
            logger.error(f"Error cifrando contraseña: {error}")
            return None

    @staticmethod
    def verificar_contraseña(contraseña_plana, contraseña_cifrada):
        """Verificar contraseña cifrada"""
        try:
            return bcrypt.checkpw(contraseña_plana.encode('utf-8'), contraseña_cifrada.encode('utf-8'))
        except Exception as error:
            logger.error(f"Error verificando contraseña: {error}")
            return False

    @staticmethod
    def validar_datos_perfil(datos_perfil):
        """Validar datos del perfil"""
        for campo in CAMPOS_PERFIL_REQUERIDOS:
            if not datos_perfil.get(campo):
                return False, f"Campo requerido faltante: {campo}"
        return True, "Datos válidos"

    @staticmethod
    def es_email_duplicado(email_a_verificar, perfiles_existentes, id_perfil_excluir=None):
        """Verificar si el email ya está registrado"""
        for perfil in perfiles_existentes:
            if perfil['email'] == email_a_verificar and perfil['id'] != id_perfil_excluir:
                return True
        return False

    @staticmethod
    def buscar_perfil_por_id(id_perfil, lista_perfiles):
        """Encontrar perfil por ID"""
        return next((perfil for perfil in lista_perfiles if perfil['id'] == id_perfil), None)

    @staticmethod
    def buscar_indice_perfil_por_id(id_perfil, lista_perfiles):
        """Encontrar índice del perfil por ID"""
        return next((indice for indice, perfil in enumerate(lista_perfiles)
                    if perfil['id'] == id_perfil), None)

    @staticmethod
    def crear_perfil_seguro(perfil):
        """Crear copia segura del perfil sin contraseña"""
        perfil_seguro = perfil.copy()
        perfil_seguro.pop('contraseña', None)
        return perfil_seguro

# Helper responses
def respuesta_error(mensaje, codigo=400):
    return jsonify({'error': mensaje}), codigo

def respuesta_exitosa(datos, codigo=200):
    return jsonify(datos), codigo

# Endpoints (idénticos)
@app.route('/perfiles', methods=['POST'])
def crear_perfil():
    """Endpoint para crear nuevo perfil"""
    try:
        datos_solicitud = request.get_json() or {}

        # Validar campos requeridos
        es_valido, mensaje_validacion = GestorPerfiles.validar_datos_perfil(datos_solicitud)
        if not es_valido:
            return respuesta_error(mensaje_validacion)

        todos_perfiles = GestorPerfiles.cargar_perfiles()

        # Validar email único
        if GestorPerfiles.es_email_duplicado(datos_solicitud['email'], todos_perfiles):
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
            'habitos_programados': datos_solicitud.get('habitos_programados', []),
            'historial_habitos': datos_solicitud.get('historial_habitos', []),
            'fecha_creacion': datetime.now().isoformat()
        }

        todos_perfiles.append(nuevo_perfil)

        if GestorPerfiles.guardar_perfiles(todos_perfiles):
            logger.info(f"Perfil creado: {nuevo_perfil['email']}")
            return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(nuevo_perfil), 201)
        else:
            return respuesta_error('Error guardando perfil', 500)

    except Exception as error:
        logger.error(f"Error inesperado creando perfil: {error}")
        return respuesta_error('Error interno del servidor', 500)

@app.route('/perfiles', methods=['GET'])
def listar_todos_perfiles():
    """Endpoint para listar todos los perfiles"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfiles_seguros = [GestorPerfiles.crear_perfil_seguro(perfil) for perfil in todos_perfiles]
        return respuesta_exitosa(perfiles_seguros)
    except Exception as error:
        logger.error(f"Error listando perfiles: {error}")
        return respuesta_error('Error obteniendo perfiles', 500)

@app.route('/perfiles/<string:id_perfil>', methods=['GET'])
def obtener_perfil_especifico(id_perfil):
    """Endpoint para obtener un perfil específico"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfil_objetivo = GestorPerfiles.buscar_perfil_por_id(id_perfil, todos_perfiles)

        if not perfil_objetivo:
            return respuesta_error('Perfil no encontrado', 404)

        return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(perfil_objetivo))
    except Exception as error:
        logger.error(f"Error obteniendo perfil {id_perfil}: {error}")
        return respuesta_error('Error obteniendo perfil', 500)

@app.route('/perfiles/<string:id_perfil>', methods=['PUT'])
def actualizar_perfil_existente(id_perfil):
    """Endpoint para actualizar un perfil existente"""
    try:
        datos_solicitud = request.get_json() or {}

        todos_perfiles = GestorPerfiles.cargar_perfiles()
        indice_perfil = GestorPerfiles.buscar_indice_perfil_por_id(id_perfil, todos_perfiles)

        if indice_perfil is None:
            return respuesta_error('Perfil no encontrado', 404)

        perfil_actual = todos_perfiles[indice_perfil]

        # Actualizar campos permitidos
        campos_actualizables = ['nombre', 'habitos_programados', 'historial_habitos']
        for campo in campos_actualizables:
            if campo in datos_solicitud:
                todos_perfiles[indice_perfil][campo] = datos_solicitud[campo]

        # Validar y actualizar email si es necesario
        if 'email' in datos_solicitud and datos_solicitud['email'] != perfil_actual['email']:
            if GestorPerfiles.es_email_duplicado(datos_solicitud['email'], todos_perfiles, id_perfil):
                return respuesta_error('El email ya está en uso')
            todos_perfiles[indice_perfil]['email'] = datos_solicitud['email']

        # Actualizar contraseña si se proporciona
        if 'contraseña' in datos_solicitud and datos_solicitud['contraseña']:
            contraseña_cifrada = GestorPerfiles.cifrar_contraseña(datos_solicitud['contraseña'])
            if contraseña_cifrada:
                todos_perfiles[indice_perfil]['contraseña'] = contraseña_cifrada

        if GestorPerfiles.guardar_perfiles(todos_perfiles):
            logger.info(f"Perfil actualizado: {id_perfil}")
            return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(todos_perfiles[indice_perfil]))
        else:
            return respuesta_error('Error guardando cambios', 500)

    except Exception as error:
        logger.error(f"Error actualizando perfil {id_perfil}: {error}")
        return respuesta_error('Error actualizando perfil', 500)

@app.route('/perfiles/<string:id_perfil>/habitos-programados', methods=['POST'])
def agregar_habito_programado(id_perfil):
    """Endpoint para agregar hábito programado"""
    try:
        datos_solicitud = request.get_json() or {}

        # Validar campos del hábito
        if not datos_solicitud.get('nombre') or not datos_solicitud.get('hora'):
            return respuesta_error('Nombre y hora son requeridos para el hábito')

        todos_perfiles = GestorPerfiles.cargar_perfiles()
        indice_perfil = GestorPerfiles.buscar_indice_perfil_por_id(id_perfil, todos_perfiles)

        if indice_perfil is None:
            return respuesta_error('Perfil no encontrado', 404)

        # Crear nuevo hábito programado
        nuevo_habito = {
            'id': GestorPerfiles.generar_id(),
            'nombre': datos_solicitud['nombre'],
            'hora': datos_solicitud['hora'],
            'categoria': datos_solicitud.get('categoria', 'general'),
            'activo': datos_solicitud.get('activo', True)
        }

        # Inicializar array si no existe
        if 'habitos_programados' not in todos_perfiles[indice_perfil]:
            todos_perfiles[indice_perfil]['habitos_programados'] = []

        todos_perfiles[indice_perfil]['habitos_programados'].append(nuevo_habito)

        if GestorPerfiles.guardar_perfiles(todos_perfiles):
            logger.info(f"Hábito programado agregado al perfil: {id_perfil}")
            return respuesta_exitosa(nuevo_habito, 201)
        else:
            return respuesta_error('Error guardando hábito programado', 500)

    except Exception as error:
        logger.error(f"Error agregando hábito programado al perfil {id_perfil}: {error}")
        return respuesta_error('Error agregando hábito programado', 500)

@app.route('/perfiles/<string:id_perfil>/historial-habitos', methods=['POST'])
def agregar_habito_historial(id_perfil):
    """Endpoint para agregar hábito al historial"""
    try:
        datos_solicitud = request.get_json() or {}

        # Validar campos del hábito
        if not all([datos_solicitud.get('nombre'), datos_solicitud.get('hora'), datos_solicitud.get('estado')]):
            return respuesta_error('Nombre, hora y estado son requeridos para el hábito')

        if datos_solicitud.get('estado') not in ['completado', 'no_completado']:
            return respuesta_error('Estado debe ser "completado" o "no_completado"')

        todos_perfiles = GestorPerfiles.cargar_perfiles()
        indice_perfil = GestorPerfiles.buscar_indice_perfil_por_id(id_perfil, todos_perfiles)

        if indice_perfil is None:
            return respuesta_error('Perfil no encontrado', 404)

        # Crear nuevo hábito en historial
        nuevo_habito = {
            'id': GestorPerfiles.generar_id(),
            'nombre': datos_solicitud['nombre'],
            'hora': datos_solicitud['hora'],
            'estado': datos_solicitud['estado'],
            'fecha': datetime.now().isoformat()
        }

        # Inicializar array si no existe
        if 'historial_habitos' not in todos_perfiles[indice_perfil]:
            todos_perfiles[indice_perfil]['historial_habitos'] = []

        todos_perfiles[indice_perfil]['historial_habitos'].append(nuevo_habito)

        if GestorPerfiles.guardar_perfiles(todos_perfiles):
            logger.info(f"Hábito agregado al historial del perfil: {id_perfil}")
            return respuesta_exitosa(nuevo_habito, 201)
        else:
            return respuesta_error('Error guardando hábito en historial', 500)

    except Exception as error:
        logger.error(f"Error agregando hábito al historial del perfil {id_perfil}: {error}")
        return respuesta_error('Error agregando hábito al historial', 500)

@app.route('/perfiles/<string:id_perfil>', methods=['DELETE'])
def eliminar_perfil(id_perfil):
    """Endpoint para eliminar un perfil"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfiles_filtrados = [perfil for perfil in todos_perfiles if perfil['id'] != id_perfil]

        if len(perfiles_filtrados) == len(todos_perfiles):
            return respuesta_error('Perfil no encontrado', 404)

        if GestorPerfiles.guardar_perfiles(perfiles_filtrados):
            logger.info(f"Perfil eliminado: {id_perfil}")
            return respuesta_exitosa({'mensaje': 'Perfil eliminado correctamente'})
        else:
            return respuesta_error('Error eliminando perfil', 500)

    except Exception as error:
        logger.error(f"Error eliminando perfil {id_perfil}: {error}")
        return respuesta_error('Error eliminando perfil', 500)

@app.route('/perfiles/login', methods=['POST'])
def login_usuario():
    """Endpoint para login de usuario"""
    try:
        datos_solicitud = request.get_json() or {}

        email = datos_solicitud.get('email')
        contraseña = datos_solicitud.get('contraseña')

        if not email or not contraseña:
            return respuesta_error('Email y contraseña requeridos')

        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfil = next((p for p in todos_perfiles if p['email'] == email), None)

        if not perfil:
            return respuesta_error('Usuario no encontrado', 404)

        # Verificar contraseña
        if not GestorPerfiles.verificar_contraseña(contraseña, perfil['contraseña']):
            return respuesta_error('Contraseña incorrecta', 401)

        logger.info(f"Login exitoso: {perfil['email']}")
        return respuesta_exitosa(GestorPerfiles.crear_perfil_seguro(perfil))

    except Exception as error:
        logger.error(f"Error en login: {error}")
        return respuesta_error('Error en el servidor', 500)

@app.route('/health', methods=['GET'])
def verificar_estado():
    """Endpoint para verificar el estado del servicio"""
    return respuesta_exitosa({
        'status': 'healthy',
        'service': 'Hábitos Saludables API',
        'timestamp': datetime.now().isoformat()
    })

def inicializar_aplicacion():
    """Inicializar la aplicación creando archivo de datos si no existe"""
    if not os.path.exists(RUTA_ARCHIVO_DATOS):
        GestorPerfiles.guardar_perfiles([])
        logger.info("Archivo de perfiles inicializado")

# ----------------------------
# MAIN DECISIÓN: ¿sincronizador o servidor?
# ----------------------------
def main():
    # Si alguno de los argumentos del sync está en sys.argv, ejecutamos sync_main preservando la interfaz original.
    sync_args_tokens = {'--file', '--watch', '--prune'}
    provided_args = set(sys.argv[1:])
    # condición: si cualquiera de las banderas conocidas aparece en los args, asumimos que el usuario quiere correr el sync
    if any(token in sys.argv for token in sync_args_tokens):
        # Pasar todos los args excepto el nombre del script a sync_main para que argparse funcione igual
        sync_main(sys.argv[1:])
    else:
        # Si no se pasan argumentos, arrancar el servidor Flask (comportamiento original de app.py)
        inicializar_aplicacion()
        logger.info("🚀 Servidor backend iniciado en http://localhost:5000")
        app.run(debug=True, host='0.0.0.0', port=5000)

if __name__ == "__main__":
    main()

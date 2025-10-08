"""
Servicio Web para Gestión de Perfiles de Hábitos Saludables
BACKEND COMPATIBLE con el frontend existente
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
from datetime import datetime
import logging
import bcrypt

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Constantes de configuración
RUTA_ARCHIVO_DATOS = 'perfiles.json'
CAMPOS_PERFIL_REQUERIDOS = ['nombre', 'email', 'contraseña']

class GestorPerfiles:
    """Clase para gestionar las operaciones de perfiles"""
    
    @staticmethod
    def cargar_perfiles():
        """Cargar todos los perfiles desde el archivo JSON"""
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
        """Guardar perfiles en el archivo JSON"""
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
            contraseña_cifrada = bcrypt.hashpw(contraseña_plana.encode('utf-8'), salt)
            return contraseña_cifrada.decode('utf-8')
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
            if perfil['email'] == email_a_verificar:
                if id_perfil_excluir and perfil['id'] == id_perfil_excluir:
                    continue
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

# ==================== ENDPOINTS PRINCIPALES ====================

@app.route('/perfiles', methods=['POST'])
def crear_perfil():
    """Endpoint para crear nuevo perfil de usuario"""
    try:
        datos_solicitud = request.get_json()
        
        if not datos_solicitud:
            return jsonify({'error': 'Datos JSON requeridos'}), 400
        
        # Validar campos requeridos
        es_valido, mensaje_validacion = GestorPerfiles.validar_datos_perfil(datos_solicitud)
        if not es_valido:
            return jsonify({'error': mensaje_validacion}), 400
        
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        
        # Validar email único
        if GestorPerfiles.es_email_duplicado(datos_solicitud['email'], todos_perfiles):
            return jsonify({'error': 'El email ya está registrado'}), 400
        
        # Cifrar contraseña
        contraseña_cifrada = GestorPerfiles.cifrar_contraseña(datos_solicitud['contraseña'])
        if not contraseña_cifrada:
            return jsonify({'error': 'Error procesando contraseña'}), 500
        
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
            
            # Devolver perfil sin contraseña
            perfil_respuesta = nuevo_perfil.copy()
            del perfil_respuesta['contraseña']
            
            return jsonify(perfil_respuesta), 201
        else:
            return jsonify({'error': 'Error guardando perfil'}), 500
            
    except Exception as error:
        logger.error(f"Error inesperado creando perfil: {error}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/perfiles', methods=['GET'])
def listar_todos_perfiles():
    """Endpoint para listar todos los perfiles"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        
        # No devolver contraseñas en la lista
        perfiles_seguros = []
        for perfil in todos_perfiles:
            perfil_seguro = perfil.copy()
            if 'contraseña' in perfil_seguro:
                del perfil_seguro['contraseña']
            perfiles_seguros.append(perfil_seguro)
            
        return jsonify(perfiles_seguros), 200
    except Exception as error:
        logger.error(f"Error listando perfiles: {error}")
        return jsonify({'error': 'Error obteniendo perfiles'}), 500

@app.route('/perfiles/<string:id_perfil>', methods=['GET'])
def obtener_perfil_especifico(id_perfil):
    """Endpoint para obtener un perfil específico por ID"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfil_objetivo = GestorPerfiles.buscar_perfil_por_id(id_perfil, todos_perfiles)
        
        if not perfil_objetivo:
            return jsonify({'error': 'Perfil no encontrado'}), 404
        
        # No devolver contraseña
        perfil_seguro = perfil_objetivo.copy()
        if 'contraseña' in perfil_seguro:
            del perfil_seguro['contraseña']
            
        return jsonify(perfil_seguro), 200
    except Exception as error:
        logger.error(f"Error obteniendo perfil {id_perfil}: {error}")
        return jsonify({'error': 'Error obteniendo perfil'}), 500

@app.route('/perfiles/<string:id_perfil>', methods=['PUT'])
def actualizar_perfil_existente(id_perfil):
    """Endpoint para actualizar un perfil existente"""
    try:
        datos_solicitud = request.get_json()
        
        if not datos_solicitud:
            return jsonify({'error': 'Datos JSON requeridos'}), 400
        
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        indice_perfil = GestorPerfiles.buscar_indice_perfil_por_id(id_perfil, todos_perfiles)
        
        if indice_perfil is None:
            return jsonify({'error': 'Perfil no encontrado'}), 404
        
        perfil_actual = todos_perfiles[indice_perfil]
        
        # Actualizar campos permitidos
        campos_actualizables = ['nombre', 'habitos_programados', 'historial_habitos']
        for campo in campos_actualizables:
            if campo in datos_solicitud:
                todos_perfiles[indice_perfil][campo] = datos_solicitud[campo]
        
        # Validar y actualizar email si es necesario
        if 'email' in datos_solicitud and datos_solicitud['email'] != perfil_actual['email']:
            if GestorPerfiles.es_email_duplicado(datos_solicitud['email'], todos_perfiles, id_perfil):
                return jsonify({'error': 'El email ya está en uso'}), 400
            todos_perfiles[indice_perfil]['email'] = datos_solicitud['email']
        
        # Actualizar contraseña si se proporciona
        if 'contraseña' in datos_solicitud and datos_solicitud['contraseña']:
            contraseña_cifrada = GestorPerfiles.cifrar_contraseña(datos_solicitud['contraseña'])
            if contraseña_cifrada:
                todos_perfiles[indice_perfil]['contraseña'] = contraseña_cifrada
        
        if GestorPerfiles.guardar_perfiles(todos_perfiles):
            logger.info(f"Perfil actualizado: {id_perfil}")
            
            # Devolver perfil sin contraseña
            perfil_actualizado = todos_perfiles[indice_perfil].copy()
            if 'contraseña' in perfil_actualizado:
                del perfil_actualizado['contraseña']
            
            return jsonify(perfil_actualizado), 200
        else:
            return jsonify({'error': 'Error guardando cambios'}), 500
            
    except Exception as error:
        logger.error(f"Error actualizando perfil {id_perfil}: {error}")
        return jsonify({'error': 'Error actualizando perfil'}), 500

@app.route('/perfiles/<string:id_perfil>/habitos-programados', methods=['POST'])
def agregar_habito_programado(id_perfil):
    """Endpoint para agregar hábito programado a un perfil"""
    try:
        datos_solicitud = request.get_json()
        
        if not datos_solicitud:
            return jsonify({'error': 'Datos JSON requeridos'}), 400
        
        # Validar campos del hábito programado
        if not datos_solicitud.get('nombre') or not datos_solicitud.get('hora'):
            return jsonify({'error': 'Nombre y hora son requeridos para el hábito'}), 400
        
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        indice_perfil = GestorPerfiles.buscar_indice_perfil_por_id(id_perfil, todos_perfiles)
        
        if indice_perfil is None:
            return jsonify({'error': 'Perfil no encontrado'}), 404
        
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
            return jsonify(nuevo_habito), 201
        else:
            return jsonify({'error': 'Error guardando hábito programado'}), 500
            
    except Exception as error:
        logger.error(f"Error agregando hábito programado al perfil {id_perfil}: {error}")
        return jsonify({'error': 'Error agregando hábito programado'}), 500

@app.route('/perfiles/<string:id_perfil>/historial-habitos', methods=['POST'])
def agregar_habito_historial(id_perfil):
    """Endpoint para agregar hábito al historial de un perfil"""
    try:
        datos_solicitud = request.get_json()
        
        if not datos_solicitud:
            return jsonify({'error': 'Datos JSON requeridos'}), 400
        
        # Validar campos del hábito
        if not datos_solicitud.get('nombre') or not datos_solicitud.get('hora') or not datos_solicitud.get('estado'):
            return jsonify({'error': 'Nombre, hora y estado son requeridos para el hábito'}), 400
        
        if datos_solicitud.get('estado') not in ['completado', 'no_completado']:
            return jsonify({'error': 'Estado debe ser "completado" o "no_completado"'}), 400
        
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        indice_perfil = GestorPerfiles.buscar_indice_perfil_por_id(id_perfil, todos_perfiles)
        
        if indice_perfil is None:
            return jsonify({'error': 'Perfil no encontrado'}), 404
        
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
            return jsonify(nuevo_habito), 201
        else:
            return jsonify({'error': 'Error guardando hábito en historial'}), 500
            
    except Exception as error:
        logger.error(f"Error agregando hábito al historial del perfil {id_perfil}: {error}")
        return jsonify({'error': 'Error agregando hábito al historial'}), 500

@app.route('/perfiles/<string:id_perfil>', methods=['DELETE'])
def eliminar_perfil(id_perfil):
    """Endpoint para eliminar un perfil"""
    try:
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfiles_filtrados = [perfil for perfil in todos_perfiles if perfil['id'] != id_perfil]
        
        if len(perfiles_filtrados) == len(todos_perfiles):
            return jsonify({'error': 'Perfil no encontrado'}), 404
        
        if GestorPerfiles.guardar_perfiles(perfiles_filtrados):
            logger.info(f"Perfil eliminado: {id_perfil}")
            return jsonify({'mensaje': 'Perfil eliminado correctamente'}), 200
        else:
            return jsonify({'error': 'Error eliminando perfil'}), 500
            
    except Exception as error:
        logger.error(f"Error eliminando perfil {id_perfil}: {error}")
        return jsonify({'error': 'Error eliminando perfil'}), 500

@app.route('/perfiles/login', methods=['POST'])
def login_usuario():
    """Endpoint para login de usuario"""
    try:
        datos_solicitud = request.get_json()
        
        if not datos_solicitud:
            return jsonify({'error': 'Datos JSON requeridos'}), 400
        
        email = datos_solicitud.get('email')
        contraseña = datos_solicitud.get('contraseña')
        
        if not email or not contraseña:
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        todos_perfiles = GestorPerfiles.cargar_perfiles()
        perfil = next((p for p in todos_perfiles if p['email'] == email), None)
        
        if not perfil:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        # Verificar contraseña
        if not GestorPerfiles.verificar_contraseña(contraseña, perfil['contraseña']):
            return jsonify({'error': 'Contraseña incorrecta'}), 401
        
        # No devolver información sensible en la respuesta
        perfil_seguro = {
            'id': perfil['id'],
            'nombre': perfil['nombre'],
            'email': perfil['email'],
            'habitos_programados': perfil.get('habitos_programados', []),
            'historial_habitos': perfil.get('historial_habitos', []),
            'fecha_creacion': perfil['fecha_creacion']
        }
        
        logger.info(f"Login exitoso: {perfil['email']}")
        return jsonify(perfil_seguro), 200
        
    except Exception as error:
        logger.error(f"Error en login: {error}")
        return jsonify({'error': 'Error en el servidor'}), 500

@app.route('/health', methods=['GET'])
def verificar_estado():
    """Endpoint para verificar el estado del servicio"""
    return jsonify({
        'status': 'healthy',
        'service': 'Hábitos Saludables API',
        'timestamp': datetime.now().isoformat()
    })

def inicializar_aplicacion():
    """Inicializar la aplicación creando archivo de datos si no existe"""
    if not os.path.exists(RUTA_ARCHIVO_DATOS):
        GestorPerfiles.guardar_perfiles([])
        logger.info("Archivo de perfiles inicializado")

if __name__ == '__main__':
    inicializar_aplicacion()
    logger.info("🚀 Servidor backend iniciado en http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
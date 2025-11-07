#!/usr/bin/env python3
"""
Sincronizador JSON -> PostgreSQL (versión limpia).
Asume que las tablas ya existen en la BD.
"""

import argparse
import json
import os
import time
import logging
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("sync_json_to_postgres")

load_dotenv()

RUTA_ARCHIVO_DATOS = os.getenv("RUTA_ARCHIVO_DATOS", "perfiles.json")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "mi_basedatos")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

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

def main():
    parser = argparse.ArgumentParser(description="Sincroniza perfiles.json -> PostgreSQL (limpio)")
    parser.add_argument('--file', default=RUTA_ARCHIVO_DATOS, help='Ruta al archivo JSON')
    parser.add_argument('--watch', type=int, default=0, help='Vigilar cambios cada N segundos (0 = una vez)')
    parser.add_argument('--prune', action='store_true', help='Eliminar en BD perfiles que no estén en el JSON')
    args = parser.parse_args()

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

if __name__ == "__main__":
    main()

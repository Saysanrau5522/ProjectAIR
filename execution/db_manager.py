"""
Database Manager for Project AIR.
Supports SQLite / Cloudflare D1 compatibility with strict relational integrity.
"""
import os
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = os.environ.get("DATABASE_PATH", "./account_ai.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = get_connection()
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    conn.close()
    print(f"[DB] Initialized database successfully at: {DB_PATH}")

def execute_query(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    result = [dict(row) for row in rows]
    conn.close()
    return result

def execute_insert(query: str, params: tuple = ()) -> Optional[int]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    last_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return last_id

def execute_update(query: str, params: tuple = ()) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected

if __name__ == "__main__":
    init_db()

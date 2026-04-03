from __future__ import annotations

import hashlib
import secrets
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Cookie, Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "sales.db"
STATIC_DIR = BASE_DIR / "static"
SESSION_COOKIE_NAME = "photo_sales_session"
SESSION_DURATION_DAYS = 7


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_session_expiry() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)).isoformat()


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    ensure_sqlite_schema(connection)
    return connection


def column_exists(connection: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    columns = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(column["name"] == column_name for column in columns)


def ensure_sqlite_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            sale_date TEXT NOT NULL,
            photo_count INTEGER NOT NULL CHECK(photo_count >= 0),
            unit_price REAL NOT NULL CHECK(unit_price >= 0),
            total_price REAL NOT NULL CHECK(total_price >= 0),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('owner', 'worker')),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )

    users_count = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if users_count == 0:
        connection.execute(
            """
            INSERT INTO users (username, password_hash, full_name, role)
            VALUES (?, ?, ?, ?)
            """,
            ("bahadir", hash_password("0658"), "Bahadır", "owner"),
        )
        connection.execute(
            """
            INSERT INTO users (username, password_hash, full_name, role)
            VALUES (?, ?, ?, ?)
            """,
            ("beth", hash_password("0606"), "Betül", "worker"),
        )

    if not column_exists(connection, "sales", "user_id"):
        connection.execute("ALTER TABLE sales ADD COLUMN user_id INTEGER")

    owner_user = connection.execute(
        "SELECT id FROM users WHERE role = 'owner' ORDER BY id ASC LIMIT 1"
    ).fetchone()
    if owner_user:
        connection.execute(
            "UPDATE sales SET user_id = ? WHERE user_id IS NULL",
            (owner_user["id"],),
        )
    connection.commit()


def init_db() -> None:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    with closing(connection):
        ensure_sqlite_schema(connection)


class SalePayload(BaseModel):
    sale_date: str = Field(..., description="Sale date in YYYY-MM-DD format")
    photo_count: int = Field(..., ge=0)
    unit_price: float = Field(..., ge=0)


class SaleUpdatePayload(SalePayload):
    pass


class LoginPayload(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


def per_photo_rate(price: float, photo_count: int) -> int:
    if photo_count < 30:
        return 0
    if photo_count <= 49:
        return 30 if price == 150 else 40 if price == 200 else 0
    if photo_count <= 79:
        return 35 if price == 150 else 45 if price == 200 else 0
    return 40 if price == 150 else 55 if price == 200 else 0


def bonus_for_200_photos(photo_count_200: int) -> int:
    if photo_count_200 >= 60:
        return 1500
    if photo_count_200 >= 40:
        return 800
    if photo_count_200 >= 20:
        return 300
    return 0


def calculate_compensation_from_counts(
    photo_count_150: int,
    photo_count_200: int,
    custom_photo_count: int,
) -> dict[str, Any]:
    rate_150 = per_photo_rate(150, photo_count_150)
    rate_200 = per_photo_rate(200, photo_count_200)

    earnings_150 = photo_count_150 * rate_150
    earnings_200 = photo_count_200 * rate_200
    bonus = bonus_for_200_photos(photo_count_200)

    return {
        "photo_count_150": photo_count_150,
        "photo_count_200": photo_count_200,
        "custom_photo_count": custom_photo_count,
        "rate_150": rate_150,
        "rate_200": rate_200,
        "earnings_150": earnings_150,
        "earnings_200": earnings_200,
        "total_photos": photo_count_150 + photo_count_200,
        "base_earnings": earnings_150 + earnings_200,
        "bonus": bonus,
        "total_earnings": earnings_150 + earnings_200 + bonus,
    }


def calculate_compensation(sales: list[dict[str, Any]]) -> dict[str, Any]:
    photo_count_150 = sum(sale["photo_count"] for sale in sales if sale["unit_price"] < 200)
    photo_count_200 = sum(sale["photo_count"] for sale in sales if sale["unit_price"] >= 200)
    custom_photo_count = sum(sale["photo_count"] for sale in sales if sale["unit_price"] not in (150, 200))
    return calculate_compensation_from_counts(photo_count_150, photo_count_200, custom_photo_count)


def fetch_sales_summary(
    connection: sqlite3.Connection,
    user_id: int | None = None,
) -> dict[str, Any]:
    where_clause = ""
    params: tuple[Any, ...] = ()

    if user_id is not None:
        where_clause = "WHERE sales.user_id = ?"
        params = (user_id,)

    totals = connection.execute(
        f"""
        SELECT
            COALESCE(SUM(sales.total_price), 0) AS grand_total,
            COALESCE(SUM(CASE WHEN sales.sale_date = DATE('now', 'localtime') THEN sales.total_price ELSE 0 END), 0) AS today_total,
            COALESCE(SUM(CASE WHEN strftime('%Y-%m', sales.sale_date) = strftime('%Y-%m', 'now', 'localtime') THEN sales.total_price ELSE 0 END), 0) AS month_total,
            COALESCE(SUM(sales.photo_count), 0) AS total_photos
        FROM sales
        {where_clause}
        """,
        params,
    ).fetchone()
    return dict(totals)


app = FastAPI(title="Photo Sales Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup_event() -> None:
    init_db()


def get_current_user(session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> dict[str, Any]:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Giriş gerekli")

    with closing(get_connection()) as connection:
        row = connection.execute(
            """
            SELECT users.id, users.username, users.full_name, users.role, users.is_active, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (session_token,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Oturum bulunamadı")

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at <= datetime.now(timezone.utc):
            connection.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
            connection.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Oturum süresi doldu")

        if row["is_active"] != 1:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Kullanıcı pasif durumda")

    return {
        "id": row["id"],
        "username": row["username"],
        "full_name": row["full_name"],
        "role": row["role"],
    }


def require_owner(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    if current_user["role"] != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok")
    return current_user


@app.get("/")
def read_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/sales")
def list_sales(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    where_clause = ""
    params: tuple[Any, ...] = ()

    if current_user["role"] == "worker":
        where_clause = "WHERE sales.user_id = ?"
        params = (current_user["id"],)

    today_date = datetime.now().date().isoformat()

    with closing(get_connection()) as connection:
        sales = connection.execute(
            f"""
            SELECT
                sales.id,
                sales.sale_date,
                sales.photo_count,
                sales.unit_price,
                sales.total_price,
                sales.created_at,
                users.username AS seller_username,
                users.full_name AS seller_name
            FROM sales
            LEFT JOIN users ON users.id = sales.user_id
            {where_clause}
            ORDER BY sales.sale_date DESC, sales.id DESC
            """,
            params,
        ).fetchall()

        totals = fetch_sales_summary(
            connection,
            current_user["id"] if current_user["role"] == "worker" else None,
        )

        daily_history: list[dict[str, Any]] = []
        if current_user["role"] == "worker":
            history_rows = connection.execute(
                """
                SELECT
                    sales.sale_date,
                    SUM(CASE WHEN sales.unit_price < 200 THEN sales.photo_count ELSE 0 END) AS photo_count_150,
                    SUM(CASE WHEN sales.unit_price >= 200 THEN sales.photo_count ELSE 0 END) AS photo_count_200,
                    SUM(CASE WHEN sales.unit_price NOT IN (150, 200) THEN sales.photo_count ELSE 0 END) AS custom_photo_count
                FROM sales
                WHERE sales.user_id = ?
                GROUP BY sales.sale_date
                ORDER BY sales.sale_date DESC
                """,
                (current_user["id"],),
            ).fetchall()

            for row in history_rows:
                day_compensation = calculate_compensation_from_counts(
                    row["photo_count_150"],
                    row["photo_count_200"],
                    row["custom_photo_count"],
                )
                daily_history.append(
                    {
                        "sale_date": row["sale_date"],
                        "photo_count_150": row["photo_count_150"],
                        "photo_count_200": row["photo_count_200"],
                        "custom_photo_count": row["custom_photo_count"],
                        "total_photos": day_compensation["total_photos"],
                        "base_earnings": day_compensation["base_earnings"],
                        "bonus": day_compensation["bonus"],
                        "total_earnings": day_compensation["total_earnings"],
                    }
                )

    sales_list = [dict(row) for row in sales]
    today_sales = [sale for sale in sales_list if sale["sale_date"] == today_date]

    return {
        "sales": sales_list,
        "summary": dict(totals),
        "compensation": calculate_compensation(today_sales),
        "daily_history": daily_history,
        "today_date": today_date,
    }


@app.get("/api/owner/summary")
def owner_summary(
    user_id: int | None = Query(default=None),
    _: dict[str, Any] = Depends(require_owner),
) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        if user_id is not None:
            user = connection.execute(
                """
                SELECT id
                FROM users
                WHERE id = ? AND is_active = 1
                """,
                (user_id,),
            ).fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

        users = connection.execute(
            """
            SELECT id, full_name, username, role
            FROM users
            WHERE is_active = 1
            ORDER BY full_name COLLATE NOCASE ASC
            """
        ).fetchall()

        summary = fetch_sales_summary(connection, user_id)

    return {
        "selected_user_id": user_id,
        "summary": summary,
        "users": [dict(row) for row in users],
    }


@app.get("/api/owner/daily-earnings")
def owner_daily_earnings(
    sale_date: str | None = Query(default=None),
    _: dict[str, Any] = Depends(require_owner),
) -> dict[str, Any]:
    selected_date = sale_date or datetime.now().date().isoformat()

    with closing(get_connection()) as connection:
        rows = connection.execute(
            """
            SELECT
                users.id AS user_id,
                users.full_name,
                users.username,
                users.role,
                sales.sale_date,
                SUM(CASE WHEN sales.unit_price < 200 THEN sales.photo_count ELSE 0 END) AS photo_count_150,
                SUM(CASE WHEN sales.unit_price >= 200 THEN sales.photo_count ELSE 0 END) AS photo_count_200,
                SUM(CASE WHEN sales.unit_price NOT IN (150, 200) THEN sales.photo_count ELSE 0 END) AS custom_photo_count
            FROM sales
            JOIN users ON users.id = sales.user_id
            WHERE sales.sale_date = ?
            GROUP BY users.id, users.full_name, users.username, users.role, sales.sale_date
            ORDER BY users.full_name COLLATE NOCASE ASC
            """,
            (selected_date,),
        ).fetchall()

    workers: list[dict[str, Any]] = []
    for row in rows:
        compensation = calculate_compensation_from_counts(
            row["photo_count_150"],
            row["photo_count_200"],
            row["custom_photo_count"],
        )
        workers.append(
            {
                "user_id": row["user_id"],
                "full_name": row["full_name"],
                "username": row["username"],
                "role": row["role"],
                "sale_date": row["sale_date"],
                "compensation": compensation,
            }
        )

    return {
        "selected_date": selected_date,
        "workers": workers,
    }


@app.get("/api/owner/worker-daily-history/{user_id}")
def owner_user_daily_history(
    user_id: int,
    _: dict[str, Any] = Depends(require_owner),
) -> dict[str, Any]:
    with closing(get_connection()) as connection:
        user = connection.execute(
            """
            SELECT id, full_name, username, role
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

        rows = connection.execute(
            """
            SELECT
                sales.sale_date,
                SUM(CASE WHEN sales.unit_price < 200 THEN sales.photo_count ELSE 0 END) AS photo_count_150,
                SUM(CASE WHEN sales.unit_price >= 200 THEN sales.photo_count ELSE 0 END) AS photo_count_200,
                SUM(CASE WHEN sales.unit_price NOT IN (150, 200) THEN sales.photo_count ELSE 0 END) AS custom_photo_count
            FROM sales
            WHERE sales.user_id = ?
            GROUP BY sales.sale_date
            ORDER BY sales.sale_date DESC
            """,
            (user_id,),
        ).fetchall()

    history: list[dict[str, Any]] = []
    for row in rows:
        compensation = calculate_compensation_from_counts(
            row["photo_count_150"],
            row["photo_count_200"],
            row["custom_photo_count"],
        )
        history.append(
            {
                "sale_date": row["sale_date"],
                "compensation": compensation,
            }
        )

    return {
        "worker": {
            "id": user["id"],
            "full_name": user["full_name"],
            "username": user["username"],
            "role": user["role"],
        },
        "history": history,
    }


@app.post("/api/sales", status_code=201)
def create_sale(payload: SalePayload, current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    total_price = round(payload.photo_count * payload.unit_price, 2)

    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO sales (user_id, sale_date, photo_count, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?)
            """,
            (current_user["id"], payload.sale_date, payload.photo_count, payload.unit_price, total_price),
        )
        connection.commit()

        sale = connection.execute(
            """
            SELECT
                sales.id,
                sales.sale_date,
                sales.photo_count,
                sales.unit_price,
                sales.total_price,
                sales.created_at,
                users.username AS seller_username,
                users.full_name AS seller_name
            FROM sales
            LEFT JOIN users ON users.id = sales.user_id
            WHERE sales.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return dict(sale)


@app.put("/api/sales/{sale_id}")
def update_sale(
    sale_id: int,
    payload: SaleUpdatePayload,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if current_user["role"] != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok")

    total_price = round(payload.photo_count * payload.unit_price, 2)

    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            UPDATE sales
            SET sale_date = ?, photo_count = ?, unit_price = ?, total_price = ?
            WHERE id = ?
            """,
            (payload.sale_date, payload.photo_count, payload.unit_price, total_price, sale_id),
        )
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı")

        sale = connection.execute(
            """
            SELECT
                sales.id,
                sales.sale_date,
                sales.photo_count,
                sales.unit_price,
                sales.total_price,
                sales.created_at,
                users.username AS seller_username,
                users.full_name AS seller_name
            FROM sales
            LEFT JOIN users ON users.id = sales.user_id
            WHERE sales.id = ?
            """,
            (sale_id,),
        ).fetchone()

    return dict(sale)


@app.delete("/api/sales/{sale_id}", status_code=204)
def delete_sale(sale_id: int, current_user: dict[str, Any] = Depends(get_current_user)) -> None:
    if current_user["role"] != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetkiniz yok")

    with closing(get_connection()) as connection:
        cursor = connection.execute("DELETE FROM sales WHERE id = ?", (sale_id,))
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı")


@app.post("/api/login")
def login(payload: LoginPayload, response: Response) -> dict[str, Any]:
    password_hash = hash_password(payload.password)

    with closing(get_connection()) as connection:
        user = connection.execute(
            """
            SELECT id, username, full_name, role, is_active
            FROM users
            WHERE username = ? AND password_hash = ?
            """,
            (payload.username, password_hash),
        ).fetchone()

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı adı veya şifre hatalı")

        if user["is_active"] != 1:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Kullanıcı pasif durumda")

        token = secrets.token_urlsafe(32)
        expires_at = build_session_expiry()

        connection.execute(
            """
            INSERT INTO sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
            """,
            (token, user["id"], expires_at),
        )
        connection.commit()

    is_https = True  # Render always serves over HTTPS
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_https,
        samesite="lax",
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
    )

    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
        }
    }


@app.post("/api/logout", status_code=204)
def logout(response: Response, session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> None:
    if session_token:
        with closing(get_connection()) as connection:
            connection.execute("DELETE FROM sessions WHERE token = ?", (session_token,))
            connection.commit()

    response.delete_cookie(SESSION_COOKIE_NAME)


@app.get("/api/session")
def session(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": current_user}


@app.get("/api/roles")
def list_roles(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {
        "current_user": current_user,
        "roles": [
            {
                "key": "owner",
                "label": "İşletme Sahibi",
                "description": "Sistemdeki tüm alanlara erişebilir ve tüm işlemleri yapabilir.",
                "permissions": [
                    "Satış kaydı görüntüleme",
                    "Satış kaydı ekleme",
                    "Satış kaydı güncelleme",
                    "Satış kaydı silme",
                    "Yetki yapısını yönetme",
                    "Tüm çalışanların satışlarını görüntüleme",
                ],
            },
            {
                "key": "worker",
                "label": "İşçi",
                "description": "Yalnızca kendi satışlarını girer ve yalnızca kendi kayıtlarını görür.",
                "permissions": [
                    "Kendi satış kaydını ekleme",
                    "Kendi satış kayıtlarını görüntüleme",
                ],
            },
        ],
    }


@app.get("/{full_path:path}")
def read_app_path(full_path: str) -> FileResponse:
    if full_path.startswith("api/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Bulunamadı")
    return FileResponse(STATIC_DIR / "index.html")

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

import os
import re
import uuid
import json
import string
import random
import secrets
import logging
import unicodedata
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form, Query, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware


# ----------------------- Config -----------------------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 24 * 7  # 7 days — convenient for PWA
REFRESH_TOKEN_TTL_DAYS = 30
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GOOGLE_PLACES_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "freccos")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("freccos")

# ----------------------- Mongo -----------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


# ----------------------- Helpers -----------------------
def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": now_utc() + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    # samesite none + secure True for cross-site cookie use (frontend served on different subdomain)
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=ACCESS_TOKEN_TTL_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=REFRESH_TOKEN_TTL_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response):
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/")


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "", text.lower())
    return text


def gen_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choices(alphabet, k=8))


COUNTRY_FLAGS = {
    "IN": "🇮🇳", "US": "🇺🇸", "GB": "🇬🇧", "FR": "🇫🇷", "IT": "🇮🇹", "ES": "🇪🇸",
    "DE": "🇩🇪", "JP": "🇯🇵", "CN": "🇨🇳", "KR": "🇰🇷", "TH": "🇹🇭", "VN": "🇻🇳",
    "ID": "🇮🇩", "AU": "🇦🇺", "NZ": "🇳🇿", "CA": "🇨🇦", "MX": "🇲🇽", "BR": "🇧🇷",
    "AR": "🇦🇷", "AE": "🇦🇪", "TR": "🇹🇷", "GR": "🇬🇷", "PT": "🇵🇹", "NL": "🇳🇱",
    "BE": "🇧🇪", "CH": "🇨🇭", "SE": "🇸🇪", "NO": "🇳🇴", "DK": "🇩🇰", "FI": "🇫🇮",
    "IE": "🇮🇪", "ZA": "🇿🇦", "EG": "🇪🇬", "MA": "🇲🇦", "SG": "🇸🇬", "MY": "🇲🇾",
    "PH": "🇵🇭", "LK": "🇱🇰", "NP": "🇳🇵", "BT": "🇧🇹", "MV": "🇲🇻",
}


def flag_for_country_code(cc: str) -> str:
    if not cc:
        return "🌍"
    cc = cc.upper()
    if cc in COUNTRY_FLAGS:
        return COUNTRY_FLAGS[cc]
    # Construct flag emoji from ISO country code regional indicators
    try:
        return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in cc if c.isalpha())
    except Exception:
        return "🌍"


# ----------------------- Storage -----------------------
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        # storage_key may have expired; reset and retry once
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                       headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 403:
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                           headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ----------------------- Auth helpers -----------------------
async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


async def _resolve_token_user(request: Request) -> Optional[dict]:
    # 1. JWT cookie
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = await get_user_by_id(payload["sub"])
                if user:
                    return user
        except jwt.PyJWTError:
            pass
    # 2. Emergent Google session_token cookie
    sess_token = request.cookies.get("session_token")
    if sess_token:
        sess = await db.user_sessions.find_one({"session_token": sess_token}, {"_id": 0})
        if sess:
            exp = sess.get("expires_at")
            if isinstance(exp, str):
                try:
                    exp = datetime.fromisoformat(exp)
                except Exception:
                    exp = None
            if exp is not None:
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp > now_utc():
                    user = await get_user_by_id(sess["user_id"])
                    if user:
                        return user
    return None


async def current_user(request: Request) -> dict:
    user = await _resolve_token_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def optional_user(request: Request) -> Optional[dict]:
    try:
        return await _resolve_token_user(request)
    except Exception:
        return None


# ----------------------- FastAPI app -----------------------
app = FastAPI(title="Freccos API")
api = APIRouter(prefix="/api")


# One-shot manual cleanup. These IDs were requested for permanent removal from
# the production database. The block is idempotent — if none of these IDs exist
# (e.g. preview DB, or already deleted on a prior boot) it's a no-op.
_PURGE_USER_IDS = (
    "0f662fb4-12d3-42f2-9900-76c1a3758b97",
    "72b72574-2293-4df2-83d1-eece251ef0d2",
    "96c8f404-159d-489f-9a55-c54e379956f7",
    "c2ffa2b3-fb3f-44dc-a152-6a70868698af",
    "e7393e71-9d26-4e6d-b438-ce7453ed363e",
    "9288cd31-2135-4ee8-93c9-d80725144d1e",
    "d5cdaab9-9f90-43ff-9a29-cca61afd0b58",
    "bbf6b2e0-29a0-4b03-98a1-11f575900d31",
    "b158b6bb-8a56-42c6-b763-fe409afd460c",
    "c32dbf97-186c-4369-bfc2-227eb08c2f8f",
    "2b09927d-3fd5-4365-8084-73684afd542b",
    "ed3336e4-15dc-452f-b337-c23449d3f7f5",
    "38ad3870-1fae-4f6b-83f0-4c11a6950750",
    "102c760b-eee4-4a52-8a6e-a67637787c03",
)


async def _purge_users(ids: tuple):
    if not ids:
        return
    id_list = list(ids)
    # Only act on IDs that actually exist (avoids logging noise on clean DBs)
    existing = [u["id"] async for u in db.users.find({"id": {"$in": id_list}}, {"_id": 0, "id": 1})]
    if not existing:
        return
    res = await db.users.delete_many({"id": {"$in": existing}})
    await db.users.update_many({}, {"$pull": {
        "following": {"$in": existing},
        "followers": {"$in": existing},
        "blocked": {"$in": existing},
    }})
    await db.recommendations.delete_many({"user_id": {"$in": existing}})
    await db.user_trips.delete_many({"user_id": {"$in": existing}})
    await db.trip_plans.delete_many({"user_id": {"$in": existing}})
    await db.follows.delete_many({"$or": [{"follower_id": {"$in": existing}}, {"following_id": {"$in": existing}}]})
    await db.follow_requests.delete_many({"$or": [{"requester_id": {"$in": existing}}, {"target_id": {"$in": existing}}]})
    await db.notifications.delete_many({"$or": [{"user_id": {"$in": existing}}, {"actor_id": {"$in": existing}}]})
    await db.user_sessions.delete_many({"user_id": {"$in": existing}})
    await db.password_reset_tokens.delete_many({"user_id": {"$in": existing}})
    # Also clear any saved_recs in other users' trip plans that reference deleted users
    await db.trip_plans.update_many({}, {"$pull": {"saved_recs": {"original_user_id": {"$in": existing}}}})
    print(f"[startup] purged {res.deleted_count} flagged user(s) and cascade-deleted their data")


async def _dedup_pair(collection_name: str, key1: str, key2: str):
    """Remove duplicate rows that share the same (key1, key2) pair, keeping the
    most recently inserted document. Used at startup to safely apply a unique
    index without crashing on pre-existing dirty data.
    Idempotent: a no-op once data is clean."""
    coll = db[collection_name]
    cursor = coll.aggregate([
        {"$group": {
            "_id": {"k1": f"${key1}", "k2": f"${key2}"},
            "ids": {"$push": "$_id"},
            "count": {"$sum": 1},
        }},
        {"$match": {"count": {"$gt": 1}}},
    ])
    removed = 0
    async for grp in cursor:
        # keep the last inserted document; delete the others
        ids = grp["ids"]
        if len(ids) <= 1:
            continue
        to_delete = ids[:-1]
        res = await coll.delete_many({"_id": {"$in": to_delete}})
        removed += res.deleted_count
    if removed:
        print(f"[startup] de-duplicated {removed} rows from {collection_name} ({key1}, {key2})")


@app.on_event("startup")
async def startup():
    # One-time purge of explicitly-flagged user IDs (idempotent)
    await _purge_users(_PURGE_USER_IDS)
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("invite_code", unique=True)
    await db.users.create_index("id", unique=True)
    await db.cities.create_index("id", unique=True)
    await db.cities.create_index([("name_lower", 1), ("country_code", 1)], unique=True)
    await db.recommendations.create_index("id", unique=True)
    await db.recommendations.create_index([("user_id", 1), ("city_id", 1)])
    await db.recommendations.create_index([("city_id", 1)])
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    # Dedup before unique index — guards against pre-existing duplicate rows
    # that would otherwise crash the backend at startup.
    await _dedup_pair("trip_plans", "user_id", "city_id")
    await db.trip_plans.create_index([("user_id", 1), ("city_id", 1)], unique=True)
    await _dedup_pair("user_trips", "user_id", "city_id")
    await db.user_trips.create_index([("user_id", 1), ("city_id", 1)], unique=True)
    await db.user_sessions.create_index("session_token")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await _dedup_pair("follow_requests", "requester_id", "target_id")
    await db.follow_requests.create_index([("requester_id", 1), ("target_id", 1)], unique=True)
    await db.follow_requests.create_index("target_id")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    # Init storage
    init_storage()
    # Seed demo users
    await seed_demo_users()


async def seed_demo_users():
    existing = await db.users.find_one({"email": "priya@freccos.com"})
    if existing:
        return
    priya_id = str(uuid.uuid4())
    arjun_id = str(uuid.uuid4())
    sara_id = str(uuid.uuid4())
    pw = hash_password("Demo1234!")
    now_iso = iso(now_utc())
    priya = {
        "id": priya_id, "name": "Priya Sharma", "email": "priya@freccos.com",
        "password_hash": pw, "profile_photo_url": None,
        "bio": "Loves quiet beaches and great coffee.",
        "invite_code": "FRECCOS1",
        "following": [arjun_id, sara_id],
        "followers": [arjun_id, sara_id],
        "auth_provider": "password", "google_id": None,
        "created_at": now_iso,
    }
    arjun = {
        "id": arjun_id, "name": "Arjun Mehta", "email": "arjun@freccos.com",
        "password_hash": pw, "profile_photo_url": None,
        "bio": "Food first. Always a window seat.",
        "invite_code": gen_invite_code(),
        "following": [priya_id, sara_id],
        "followers": [priya_id, sara_id],
        "auth_provider": "password", "google_id": None,
        "created_at": now_iso,
    }
    sara = {
        "id": sara_id, "name": "Sara Iyer", "email": "sara@freccos.com",
        "password_hash": pw, "profile_photo_url": None,
        "bio": "Weekend wanderer. Mountains over malls.",
        "invite_code": gen_invite_code(),
        "following": [priya_id, arjun_id],
        "followers": [priya_id, arjun_id],
        "auth_provider": "password", "google_id": None,
        "created_at": now_iso,
    }
    await db.users.insert_many([priya, arjun, sara])
    for a, b in [(priya_id, arjun_id), (priya_id, sara_id), (arjun_id, sara_id)]:
        await db.follows.insert_one({"follower_id": a, "following_id": b, "created_at": now_iso})
        await db.follows.insert_one({"follower_id": b, "following_id": a, "created_at": now_iso})

    # Seed cities
    alibag = {"id": str(uuid.uuid4()), "name": "Alibag", "name_lower": "alibag",
              "country": "India", "country_code": "IN", "flag_emoji": "🇮🇳"}
    goa = {"id": str(uuid.uuid4()), "name": "Goa", "name_lower": "goa",
           "country": "India", "country_code": "IN", "flag_emoji": "🇮🇳"}
    paris = {"id": str(uuid.uuid4()), "name": "Paris", "name_lower": "paris",
             "country": "France", "country_code": "FR", "flag_emoji": "🇫🇷"}
    tokyo = {"id": str(uuid.uuid4()), "name": "Tokyo", "name_lower": "tokyo",
             "country": "Japan", "country_code": "JP", "flag_emoji": "🇯🇵"}
    await db.cities.insert_many([alibag, goa, paris, tokyo])

    # Seed recs
    seed_recs = [
        # Alibag — overlap on "Sundowner Cafe" between Priya & Arjun (Top Pick)
        (priya_id, alibag["id"], "Sundowner Cafe", "food",
         "Get there for sunset — order the prawns and the lemon iced tea.", None),
        (arjun_id, alibag["id"], "Sundowner Cafe", "food",
         "Don’t skip the calamari. Sit on the deck.", None),
        (sara_id, alibag["id"], "Mango House Villa", "stay",
         "Lovely garden, hosts are wonderful. Book the upstairs room.", None),
        (priya_id, alibag["id"], "Kashid Beach", "experience",
         "Less crowded than Alibag main beach. Go early morning.", None),
        # Goa
        (priya_id, goa["id"], "Gunpowder", "food",
         "South Indian done right. Try the appam + stew.", None),
        (arjun_id, goa["id"], "Thalassa", "experience",
         "Pricey but the cliffside views at sunset are unbeatable.", None),
        # Paris
        (priya_id, paris["id"], "Le Comptoir du Relais", "food",
         "Cozy bistro near Odéon — go for lunch, it’s easier to get in.", None),
        (sara_id, paris["id"], "Hotel Henriette", "stay",
         "Tucked away in the 13th — the breakfast nook is everything.", None),
        # Tokyo
        (arjun_id, tokyo["id"], "Sushi Saito", "food",
         "Reserve months in advance. Worth every yen.", None),
    ]
    for uid, cid, name, cat, note, photo in seed_recs:
        await db.recommendations.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid, "city_id": cid,
            "place_name": name, "place_id": None,
            "place_address": None,
            "place_name_normalized": slugify(name),
            "category": cat, "note": note,
            "photo_url": photo,
            "created_at": now_iso,
        })
    logger.info("Seeded demo users + recommendations.")


# ----------------------- Models -----------------------
class RegisterReq(BaseModel):
    invite_code: Optional[str] = None
    name: str
    email: EmailStr
    password: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class ValidateInviteReq(BaseModel):
    code: str


class ForgotPasswordReq(BaseModel):
    email: EmailStr


class ResetPasswordReq(BaseModel):
    token: str
    new_password: str


class GoogleSessionReq(BaseModel):
    session_id: str


class UpdateProfileReq(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    is_private: Optional[bool] = None
    instagram_handle: Optional[str] = None


class RecCreateReq(BaseModel):
    place_name: str
    category: str  # food|experience|stay|getting_around
    city_name: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    city_id: Optional[str] = None
    place_id: Optional[str] = None
    place_address: Optional[str] = None
    note: Optional[str] = None
    photo_url: Optional[str] = None


class RecUpdateReq(BaseModel):
    place_name: Optional[str] = None
    category: Optional[str] = None
    note: Optional[str] = None
    photo_url: Optional[str] = None


class BucketListReq(BaseModel):
    city_id: Optional[str] = None
    city_name: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None


class TripReq(BaseModel):
    city_id: Optional[str] = None
    city_name: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None


class SaveRecReq(BaseModel):
    recommendation_id: str  # any rec representing the place to save


class CheckRecReq(BaseModel):
    recommendation_id: str
    checked: bool


# ----------------------- Helpers — users/cities -----------------------
def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u.get("name"),
        "email": u.get("email"),
        "bio": u.get("bio"),
        "profile_photo_url": u.get("profile_photo_url"),
        "invite_code": u.get("invite_code"),
        "following": u.get("following", []),
        "followers": u.get("followers", []),
        "auth_provider": u.get("auth_provider"),
        "is_private": bool(u.get("is_private", False)),
        "instagram_handle": u.get("instagram_handle"),
        "blocked": u.get("blocked", []),
        "created_at": u.get("created_at"),
    }


def public_user_brief(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u.get("name"),
        "bio": u.get("bio"),
        "profile_photo_url": u.get("profile_photo_url"),
        "is_private": bool(u.get("is_private", False)),
    }


async def upsert_city(name: str, country: Optional[str] = None,
                     country_code: Optional[str] = None) -> dict:
    if not name:
        raise HTTPException(status_code=400, detail="City name required")
    name = name.strip()
    name_lower = name.lower()
    cc = (country_code or "").upper() or None
    existing = await db.cities.find_one(
        {"name_lower": name_lower, "country_code": cc}, {"_id": 0}
    )
    if existing:
        return existing
    city = {
        "id": str(uuid.uuid4()),
        "name": name, "name_lower": name_lower,
        "country": country or "",
        "country_code": cc or "",
        "flag_emoji": flag_for_country_code(cc) if cc else "🌍",
    }
    await db.cities.insert_one(city)
    city.pop("_id", None)
    return city


async def user_travel_stats(user_ids: List[str]) -> dict:
    """Return {user_id: {'city_count': N, 'country_count': N}} for the given user_ids."""
    if not user_ids:
        return {}
    pipeline = [
        {"$match": {"user_id": {"$in": user_ids}}},
        {"$group": {"_id": {"user_id": "$user_id", "city_id": "$city_id"}}},
        {"$group": {"_id": "$_id.user_id", "city_ids": {"$addToSet": "$_id.city_id"}}},
    ]
    rows = await db.recommendations.aggregate(pipeline).to_list(1000)
    if not rows:
        return {uid: {"city_count": 0, "country_count": 0} for uid in user_ids}
    all_city_ids = list({cid for r in rows for cid in r["city_ids"]})
    city_country = {}
    async for c in db.cities.find({"id": {"$in": all_city_ids}}, {"_id": 0, "id": 1, "country": 1}):
        city_country[c["id"]] = c.get("country") or ""
    out = {uid: {"city_count": 0, "country_count": 0} for uid in user_ids}
    for r in rows:
        cids = r["city_ids"]
        countries = {city_country.get(cid, "") for cid in cids if city_country.get(cid)}
        out[r["_id"]] = {"city_count": len(cids), "country_count": len(countries)}
    return out


# ----------------------- Auth routes -----------------------
@api.post("/auth/validate-invite")
async def validate_invite(req: ValidateInviteReq):
    code = (req.code or "").strip().upper()
    if not code:
        return {"valid": False, "message": "Enter an invite code."}
    user = await db.users.find_one({"invite_code": code}, {"_id": 0})
    if not user:
        return {"valid": False, "message": "That code doesn't ring a bell — double-check it or skip and join solo"}
    return {"valid": True, "referrer_name": user.get("name"), "referrer_id": user["id"]}


@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    code = (req.invite_code or "").strip().upper()
    email = req.email.strip().lower()
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password should be at least 6 characters")
    referrer = None
    if code:
        referrer = await db.users.find_one({"invite_code": code}, {"_id": 0})
        if not referrer:
            raise HTTPException(status_code=400, detail="That code doesn't ring a bell — double-check it or skip and join solo")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Looks like you already have an account — try logging in")
    # generate unique invite code
    for _ in range(8):
        new_code = gen_invite_code()
        if not await db.users.find_one({"invite_code": new_code}):
            break
    user_id = str(uuid.uuid4())
    now_iso = iso(now_utc())
    following = [referrer["id"]] if referrer else []
    followers = [referrer["id"]] if referrer else []
    user = {
        "id": user_id, "name": req.name.strip(), "email": email,
        "password_hash": hash_password(req.password),
        "profile_photo_url": None, "bio": "",
        "invite_code": new_code,
        "is_private": True,  # Private by default — users can switch to public in Settings
        "following": following,
        "followers": followers,
        "auth_provider": "password", "google_id": None,
        "created_at": now_iso,
    }
    await db.users.insert_one(user)
    # mutual follow when invited
    if referrer:
        await db.users.update_one({"id": referrer["id"]}, {
            "$addToSet": {"following": user_id, "followers": user_id}
        })
        await db.follows.insert_one({"follower_id": user_id, "following_id": referrer["id"], "created_at": now_iso})
        await db.follows.insert_one({"follower_id": referrer["id"], "following_id": user_id, "created_at": now_iso})
        # Notify referrer that someone joined using their code
        await create_notification(referrer["id"], "invite_signup", actor_id=user_id)

    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    user.pop("password_hash", None)
    return public_user(user)


@api.post("/auth/login")
async def login(req: LoginReq, response: Response):
    email = req.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="That password doesn't match — want to reset it?")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    user.pop("_id", None); user.pop("password_hash", None)
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    sess_token = request.cookies.get("session_token")
    if sess_token:
        await db.user_sessions.delete_one({"session_token": sess_token})
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordReq):
    email = req.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"],
            "expires_at": now_utc() + timedelta(hours=1),
            "used": False,
        })
        # STUBBED: log the reset link instead of emailing
        logger.info(f"[forgot-password] reset link for {email}: token={token}")
    # always return success to avoid email enumeration
    return {"ok": True, "message": "If that email exists, we just sent a reset link."}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordReq):
    tok = await db.password_reset_tokens.find_one({"token": req.token})
    if not tok or tok.get("used"):
        raise HTTPException(status_code=400, detail="This reset link isn't valid anymore.")
    exp = tok.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=400, detail="This reset link has expired.")
    await db.users.update_one({"id": tok["user_id"]},
                              {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_reset_tokens.update_one({"_id": tok["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


@api.post("/auth/google/session")
async def google_session(req: GoogleSessionReq, response: Response):
    # Exchange session_id with Emergent
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": req.session_id}, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Google session exchange failed: {e}")
        raise HTTPException(status_code=400, detail="Couldn't sign in with Google. Please try again.")
    email = (data.get("email") or "").strip().lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Google response was incomplete.")
    now_iso = iso(now_utc())
    user = await db.users.find_one({"email": email})
    if not user:
        # First Google sign-in — auto-create user with no invite (Google login is its own onboarding gate)
        for _ in range(8):
            new_code = gen_invite_code()
            if not await db.users.find_one({"invite_code": new_code}):
                break
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id, "name": name, "email": email,
            "password_hash": None, "profile_photo_url": picture, "bio": "",
            "invite_code": new_code,
            "is_private": True,  # Private by default
            "following": [], "followers": [],
            "auth_provider": "google", "google_id": data.get("id"),
            "created_at": now_iso,
        }
        await db.users.insert_one(user)
    else:
        # mark as both if user had password before
        provider = user.get("auth_provider", "password")
        if provider != "google" and provider != "both":
            await db.users.update_one({"id": user["id"]}, {"$set": {"auth_provider": "both", "google_id": data.get("id")}})

    # Store session token row
    await db.user_sessions.insert_one({
        "user_id": user["id"], "session_token": session_token,
        "expires_at": now_utc() + timedelta(days=7),
        "created_at": now_iso,
    })
    # Set both Emergent session cookie and our own JWT cookies so the rest of the app works seamlessly
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none",
                        max_age=7 * 86400, path="/")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    user.pop("_id", None); user.pop("password_hash", None)
    return public_user(user)


# ----------------------- Upload -----------------------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(current_user)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image.")
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image is too large (max 8MB).")
    result = put_object(path, data, file.content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"],
        "storage_path": result["path"], "content_type": file.content_type,
        "size": result.get("size", len(data)), "is_deleted": False,
        "created_at": iso(now_utc()),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(path)
    return Response(content=data, media_type=rec.get("content_type") or ct)


# ----------------------- Users / Follow -----------------------
@api.get("/users/search")
async def search_users(q: str = "", user: dict = Depends(current_user)):
    q = (q or "").strip()
    blocked = set(user.get("blocked", []))
    query = {"id": {"$ne": user["id"]}}
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    cursor = db.users.find(query, {"_id": 0, "password_hash": 0}).limit(80)
    results = []
    raw = []
    async for u in cursor:
        if u["id"] in blocked or user["id"] in u.get("blocked", []):
            continue
        raw.append(u)
    stats = await user_travel_stats([u["id"] for u in raw])
    # Batch-fetch all pending follow requests at once (was N+1 per private user)
    private_ids = [u["id"] for u in raw if u.get("is_private") and user["id"] not in u.get("followers", [])]
    pending_set: set = set()
    if private_ids:
        async for fr in db.follow_requests.find(
            {"requester_id": user["id"], "target_id": {"$in": private_ids}},
            {"_id": 0, "target_id": 1},
        ):
            pending_set.add(fr["target_id"])
    for u in raw:
        is_following = user["id"] in u.get("followers", [])
        pending = (u["id"] in pending_set) if (u.get("is_private") and not is_following) else False
        s = stats.get(u["id"], {"city_count": 0, "country_count": 0})
        results.append({**public_user_brief(u),
                        "is_following": is_following,
                        "request_pending": pending,
                        "city_count": s["city_count"],
                        "country_count": s["country_count"]})
    return results


@api.get("/users/{user_id}")
async def get_user_profile(user_id: str, user: dict = Depends(current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Mutual block silently hides
    if user_id in user.get("blocked", []) or user["id"] in target.get("blocked", []):
        raise HTTPException(status_code=404, detail="User not found")

    is_self = user_id == user["id"]
    is_follower = user["id"] in target.get("followers", [])
    is_private = bool(target.get("is_private"))
    can_view_full = is_self or (not is_private) or is_follower

    base = {
        **public_user_brief(target),
        "instagram_handle": target.get("instagram_handle"),
        "is_following": is_follower,
        "is_private": is_private,
        "follows_me": target["id"] in user.get("following", []),
        "follower_count": len(target.get("followers", [])),
        "following_count": len(target.get("following", [])),
        "created_at": target.get("created_at"),
    }
    # Pending follow request?
    if not is_self and not is_follower and is_private:
        pending = await db.follow_requests.find_one({"requester_id": user["id"], "target_id": user_id})
        base["request_status"] = "requested" if pending else "none"

    if not can_view_full:
        # Limited payload — name, photo, bio only. No stats, no cities.
        return {**base, "city_count": 0, "country_count": 0, "cities": [], "countries": [], "can_view": False}

    # Full payload: union of rec-cities and explicit trips
    rec_ids_by_city: dict = {}
    async for r in db.recommendations.find(
        {"user_id": user_id},
        {"_id": 0, "city_id": 1, "photo_url": 1},
    ).limit(2000):
        rec_ids_by_city.setdefault(r["city_id"], []).append(r)
    trip_city_ids = set()
    async for t in db.user_trips.find({"user_id": user_id}, {"_id": 0, "city_id": 1}).limit(500):
        trip_city_ids.add(t["city_id"])
    all_city_ids = list(set(rec_ids_by_city.keys()) | trip_city_ids)
    cities = []
    if all_city_ids:
        async for c in db.cities.find({"id": {"$in": all_city_ids}}, {"_id": 0}).limit(500):
            recs = rec_ids_by_city.get(c["id"], [])
            photos = [r["photo_url"] for r in recs if r.get("photo_url")][:3]
            cities.append({**c, "rec_count": len(recs), "photos": photos})
    countries = sorted({c["country"] for c in cities if c.get("country")})
    return {
        **base,
        "city_count": len(cities),
        "country_count": len(countries),
        "cities": cities,
        "countries": countries,
        "can_view": True,
    }


async def create_notification(user_id: str, kind: str, actor_id: Optional[str] = None, payload: Optional[dict] = None):
    """Add a notification for `user_id`. kind ∈ follow_request | new_follower | invite_signup | bucket_recs"""
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id, "actor_id": actor_id,
        "kind": kind, "payload": payload or {},
        "read": False, "created_at": iso(now_utc()),
    })


@api.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user: dict = Depends(current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Can't follow yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Blocked either way → silently no-op
    if user["id"] in target.get("blocked", []) or user_id in user.get("blocked", []):
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_private"):
        # Already following? short-circuit
        if user["id"] in target.get("followers", []):
            return {"status": "following"}
        # Create follow request (idempotent)
        try:
            await db.follow_requests.insert_one({
                "id": str(uuid.uuid4()),
                "requester_id": user["id"], "target_id": user_id,
                "status": "pending", "created_at": iso(now_utc()),
            })
            await create_notification(user_id, "follow_request", actor_id=user["id"])
        except Exception:
            pass  # already requested
        return {"status": "requested"}
    # Public follow — direct
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"following": user_id}})
    await db.users.update_one({"id": user_id}, {"$addToSet": {"followers": user["id"]}})
    try:
        await db.follows.insert_one({"follower_id": user["id"], "following_id": user_id, "created_at": iso(now_utc())})
    except Exception:
        pass
    await create_notification(user_id, "new_follower", actor_id=user["id"])
    return {"status": "following"}


@api.post("/users/{user_id}/unfollow")
async def unfollow_user(user_id: str, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"following": user_id}})
    await db.users.update_one({"id": user_id}, {"$pull": {"followers": user["id"]}})
    await db.follows.delete_one({"follower_id": user["id"], "following_id": user_id})
    # Clear any pending request
    await db.follow_requests.delete_one({"requester_id": user["id"], "target_id": user_id})
    return {"status": "not_following"}


@api.delete("/users/me/followers/{user_id}")
async def remove_follower(user_id: str, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"followers": user_id}})
    await db.users.update_one({"id": user_id}, {"$pull": {"following": user["id"]}})
    await db.follows.delete_one({"follower_id": user_id, "following_id": user["id"]})
    return {"ok": True}


@api.get("/users/me/follow-requests")
async def my_follow_requests(user: dict = Depends(current_user)):
    out = []
    async for r in db.follow_requests.find({"target_id": user["id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).limit(100):
        requester = await db.users.find_one({"id": r["requester_id"]}, {"_id": 0, "password_hash": 0})
        if requester:
            out.append({**r, "requester": public_user_brief(requester)})
    return out


@api.post("/users/me/follow-requests/{request_id}/accept")
async def accept_request(request_id: str, user: dict = Depends(current_user)):
    req = await db.follow_requests.find_one({"id": request_id, "target_id": user["id"]})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    rid = req["requester_id"]
    await db.users.update_one({"id": rid}, {"$addToSet": {"following": user["id"]}})
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"followers": rid}})
    await db.follow_requests.delete_one({"id": request_id})
    try:
        await db.follows.insert_one({"follower_id": rid, "following_id": user["id"], "created_at": iso(now_utc())})
    except Exception:
        pass
    # Mark related notification as read
    await db.notifications.update_many({"user_id": user["id"], "kind": "follow_request", "actor_id": rid}, {"$set": {"read": True}})
    await create_notification(rid, "request_accepted", actor_id=user["id"])
    return {"ok": True}


@api.post("/users/me/follow-requests/{request_id}/decline")
async def decline_request(request_id: str, user: dict = Depends(current_user)):
    await db.follow_requests.delete_one({"id": request_id, "target_id": user["id"]})
    return {"ok": True}


@api.post("/users/{user_id}/block")
async def block_user(user_id: str, user: dict = Depends(current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Can't block yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Remove follow relationships both ways
    await db.users.update_one({"id": user["id"]}, {"$pull": {"following": user_id, "followers": user_id}, "$addToSet": {"blocked": user_id}})
    await db.users.update_one({"id": user_id}, {"$pull": {"following": user["id"], "followers": user["id"]}})
    await db.follows.delete_many({"$or": [
        {"follower_id": user["id"], "following_id": user_id},
        {"follower_id": user_id, "following_id": user["id"]},
    ]})
    await db.follow_requests.delete_many({"$or": [
        {"requester_id": user["id"], "target_id": user_id},
        {"requester_id": user_id, "target_id": user["id"]},
    ]})
    return {"ok": True}


@api.post("/users/{user_id}/unblock")
async def unblock_user(user_id: str, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"blocked": user_id}})
    return {"ok": True}


@api.delete("/users/me")
async def delete_my_account(response: Response, user: dict = Depends(current_user)):
    """Permanently delete the signed-in user and all their data."""
    uid = user["id"]
    # Wipe the user from everyone else's following/followers lists
    await db.users.update_many({}, {"$pull": {"following": uid, "followers": uid, "blocked": uid}})
    # Delete their own document
    await db.users.delete_one({"id": uid})
    # Clean up all related data
    await db.recommendations.delete_many({"user_id": uid})
    await db.user_trips.delete_many({"user_id": uid})
    await db.trip_plans.delete_many({"user_id": uid})
    await db.follows.delete_many({"$or": [{"follower_id": uid}, {"following_id": uid}]})
    await db.follow_requests.delete_many({"$or": [{"requester_id": uid}, {"target_id": uid}]})
    await db.notifications.delete_many({"$or": [{"user_id": uid}, {"actor_id": uid}]})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.password_reset_tokens.delete_many({"user_id": uid})
    # Clear cookies
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/users/me/blocked")
async def my_blocked(user: dict = Depends(current_user)):
    blocked_ids = user.get("blocked", [])
    if not blocked_ids:
        return []
    out = []
    async for u in db.users.find({"id": {"$in": blocked_ids}}, {"_id": 0, "password_hash": 0}).limit(200):
        out.append(public_user_brief(u))
    return out


@api.get("/users/me/notifications")
async def my_notifications(user: dict = Depends(current_user)):
    items = []
    async for n in db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100):
        actor = None
        if n.get("actor_id"):
            au = await db.users.find_one({"id": n["actor_id"]}, {"_id": 0, "password_hash": 0})
            if au:
                actor = public_user_brief(au)
        items.append({**n, "actor": actor})
    # Stable ordering: pending follow requests first (within the recency window)
    items.sort(key=lambda x: (0 if x["kind"] == "follow_request" and not x.get("read") else 1, x["created_at"]), reverse=False)
    # Reverse for newest-first while keeping follow requests on top
    pending = [i for i in items if i["kind"] == "follow_request" and not i.get("read")]
    rest = [i for i in items if not (i["kind"] == "follow_request" and not i.get("read"))]
    pending.sort(key=lambda x: x["created_at"], reverse=True)
    rest.sort(key=lambda x: x["created_at"], reverse=True)
    return pending + rest


@api.post("/users/me/notifications/mark-read")
async def mark_notifications_read(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/users/me/notifications/unread-count")
async def unread_count(user: dict = Depends(current_user)):
    c = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": c}


@api.get("/users/{user_id}/followers")
async def get_followers(user_id: str, user: dict = Depends(current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Visibility: target public, or it's yourself, or you follow them
    if target.get("is_private") and user_id != user["id"] and user["id"] not in target.get("followers", []):
        raise HTTPException(status_code=403, detail="This account is private")
    ids = target.get("followers", [])
    if not ids:
        return []
    me_blocked = set(user.get("blocked", []))
    out = []
    async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).limit(500):
        if u["id"] in me_blocked or user["id"] in u.get("blocked", []):
            continue
        out.append({**public_user_brief(u), "is_following": user["id"] in u.get("followers", [])})
    return out


@api.get("/users/{user_id}/following")
async def get_following(user_id: str, user: dict = Depends(current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_private") and user_id != user["id"] and user["id"] not in target.get("followers", []):
        raise HTTPException(status_code=403, detail="This account is private")
    ids = target.get("following", [])
    if not ids:
        return []
    me_blocked = set(user.get("blocked", []))
    out = []
    async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).limit(500):
        if u["id"] in me_blocked or user["id"] in u.get("blocked", []):
            continue
        out.append({**public_user_brief(u), "is_following": user["id"] in u.get("followers", [])})
    return out


@api.patch("/users/me")
async def update_me(req: UpdateProfileReq, user: dict = Depends(current_user)):
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return public_user(u)


@api.get("/users/me/discover")
async def discover(user: dict = Depends(current_user)):
    """Curated discovery — friends of friends, active this week, bucket-list matches, recently joined."""
    my_id = user["id"]
    my_following = set(user.get("following", []))
    blocked = set(user.get("blocked", []))
    seen = blocked | {my_id} | my_following  # exclude already-followed & yourself from "discover" sections

    # Helper to enrich users with stats + latest rec + follow state
    async def enrich(user_ids: list, extras: dict = None):
        if not user_ids:
            return []
        extras = extras or {}
        users_by_id = {u["id"]: u async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).limit(200)}
        valid_ids = [uid for uid in user_ids if uid in users_by_id and my_id not in users_by_id[uid].get("blocked", [])]
        stats = await user_travel_stats(valid_ids)
        # latest rec per user — collect first, then batch-fetch cities (was N+1)
        latest_by_user = {}
        rec_city_ids = []
        async for r in db.recommendations.find({"user_id": {"$in": valid_ids}}, {"_id": 0}).sort("created_at", -1).limit(500):
            if r["user_id"] not in latest_by_user:
                latest_by_user[r["user_id"]] = {"place_name": r["place_name"], "_city_id": r["city_id"]}
                rec_city_ids.append(r["city_id"])
        city_name_by_id: dict = {}
        if rec_city_ids:
            async for c in db.cities.find({"id": {"$in": list(set(rec_city_ids))}}, {"_id": 0, "id": 1, "name": 1, "country": 1}):
                city_name_by_id[c["id"]] = c.get("name")
        for uid, lr in latest_by_user.items():
            lr["city_name"] = city_name_by_id.get(lr.pop("_city_id"))
        # Batch-fetch pending follow requests for the private users we're enriching (was N+1)
        private_ids = [uid for uid in valid_ids
                       if users_by_id[uid].get("is_private") and my_id not in users_by_id[uid].get("followers", [])]
        pending_set: set = set()
        if private_ids:
            async for fr in db.follow_requests.find(
                {"requester_id": my_id, "target_id": {"$in": private_ids}},
                {"_id": 0, "target_id": 1},
            ):
                pending_set.add(fr["target_id"])
        out = []
        for uid in valid_ids:
            u = users_by_id[uid]
            s = stats.get(uid, {"city_count": 0, "country_count": 0})
            is_following = my_id in u.get("followers", [])
            request_pending = (uid in pending_set) if (u.get("is_private") and not is_following) else False
            out.append({
                **public_user_brief(u),
                "city_count": s["city_count"],
                "country_count": s["country_count"],
                "latest_rec": latest_by_user.get(uid),
                "is_following": is_following,
                "request_pending": request_pending,
                **(extras.get(uid) or {}),
            })
        return out

    # 1. Friends of friends (followed by 2+ of your follows)
    fof_counts = {}
    fof_followers = {}
    if my_following:
        async for u in db.users.find({"id": {"$in": list(my_following)}}, {"_id": 0, "following": 1, "name": 1}).limit(200):
            for fid in u.get("following", []):
                if fid in seen:
                    continue
                fof_counts[fid] = fof_counts.get(fid, 0) + 1
                fof_followers.setdefault(fid, []).append(u.get("name"))
    fof_ids = [uid for uid, c in fof_counts.items() if c >= 2][:30]
    fof_extras = {uid: {"followed_by": fof_followers[uid][:3]} for uid in fof_ids}
    fof = await enrich(fof_ids, fof_extras)

    # 2. Active this week
    week_ago = (now_utc() - timedelta(days=7)).isoformat()
    active_ids = []
    seen_active = set()
    async for r in db.recommendations.find({"created_at": {"$gte": week_ago}}, {"_id": 0, "user_id": 1}).sort("created_at", -1).limit(500):
        uid = r["user_id"]
        if uid in seen or uid in seen_active:
            continue
        seen_active.add(uid)
        active_ids.append(uid)
        if len(active_ids) >= 20:
            break
    active = await enrich(active_ids)

    # 3. Bucket-list matches — users who have recs in cities I have on my bucket list
    bucket_city_ids = set()
    async for p in db.trip_plans.find({"user_id": my_id}, {"_id": 0, "city_id": 1}).limit(200):
        bucket_city_ids.add(p["city_id"])
    bucket_users = []
    bucket_match_city = {}
    if bucket_city_ids:
        # Collect candidate (user_id, city_id) pairs first, then batch-fetch city names (was N+1)
        candidates = []
        async for r in db.recommendations.find(
            {"city_id": {"$in": list(bucket_city_ids)}},
            {"_id": 0, "user_id": 1, "city_id": 1},
        ).limit(500):
            uid = r["user_id"]
            if uid in seen or uid in bucket_match_city:
                continue
            bucket_match_city[uid] = {"_city_id": r["city_id"]}
            candidates.append(uid)
            if len(candidates) >= 20:
                break
        city_name_by_id: dict = {}
        wanted = list({v["_city_id"] for v in bucket_match_city.values()})
        if wanted:
            async for c in db.cities.find({"id": {"$in": wanted}}, {"_id": 0, "id": 1, "name": 1}):
                city_name_by_id[c["id"]] = c.get("name")
        for uid, v in bucket_match_city.items():
            v["matched_city"] = city_name_by_id.get(v.pop("_city_id"))
        bucket_users = candidates
    bucket = await enrich(bucket_users, bucket_match_city)

    # 4. Recently joined (last 30 days)
    cutoff = (now_utc() - timedelta(days=30)).isoformat()
    recent_ids = []
    async for u in db.users.find({"created_at": {"$gte": cutoff}, "id": {"$nin": list(seen)}}, {"_id": 0, "id": 1}).sort("created_at", -1).limit(20):
        recent_ids.append(u["id"])
    recent = await enrich(recent_ids)

    return {
        "friends_of_friends": fof,
        "active_this_week": active,
        "bucket_matches": bucket,
        "recently_joined": recent,
    }


# ----------------------- Cities -----------------------
@api.get("/cities")
async def list_cities(q: str = "", user: dict = Depends(current_user)):
    q = (q or "").strip().lower()
    query: dict = {}
    if q:
        query["name_lower"] = {"$regex": re.escape(q)}
    cursor = db.cities.find(query, {"_id": 0}).limit(50)
    return [c async for c in cursor]


@api.get("/cities/{city_id}")
async def get_city(city_id: str, user: dict = Depends(current_user)):
    c = await db.cities.find_one({"id": city_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="City not found")
    return c


@api.get("/explore/cities")
async def explore_cities(user: dict = Depends(current_user)):
    """Cities where at least one followed user has a recommendation.
    The current user's own recs are intentionally excluded — Explore is for
    discovering what your people have been to, not your own content."""
    following_ids = user.get("following", [])
    if not following_ids:
        return []
    pipeline = [
        {"$match": {"user_id": {"$in": following_ids}}},
        {"$group": {"_id": "$city_id", "user_ids": {"$addToSet": "$user_id"}, "count": {"$sum": 1}}},
    ]
    agg = await db.recommendations.aggregate(pipeline).to_list(500)
    if not agg:
        return []
    city_ids = [a["_id"] for a in agg]
    cities = {c["id"]: c async for c in db.cities.find({"id": {"$in": city_ids}}, {"_id": 0})}
    # collect avatar info for friends
    friend_ids_all = list({uid for a in agg for uid in a["user_ids"]})
    users = {u["id"]: public_user_brief(u) async for u in db.users.find({"id": {"$in": friend_ids_all}}, {"_id": 0, "password_hash": 0})}
    out = []
    for a in agg:
        c = cities.get(a["_id"])
        if not c:
            continue
        friend_briefs = [users[uid] for uid in a["user_ids"] if uid in users]
        out.append({**c, "friend_count": len(friend_briefs), "rec_count": a["count"], "friends": friend_briefs})
    out.sort(key=lambda x: x["rec_count"], reverse=True)
    return out


@api.get("/explore/cities/{city_id}/friends")
async def explore_city_friends(city_id: str, user: dict = Depends(current_user)):
    """Friends with recs in this city. Excludes the current user."""
    following_ids = user.get("following", [])
    if not following_ids:
        return []
    pipeline = [
        {"$match": {"city_id": city_id, "user_id": {"$in": following_ids}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
    ]
    agg = await db.recommendations.aggregate(pipeline).to_list(500)
    if not agg:
        return []
    user_ids = [a["_id"] for a in agg]
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0})}
    stats = await user_travel_stats(user_ids)
    out = []
    for a in agg:
        if a["_id"] not in users:
            continue
        s = stats.get(a["_id"], {"city_count": 0, "country_count": 0})
        out.append({**public_user_brief(users[a["_id"]]),
                    "rec_count": a["count"],
                    "city_count": s["city_count"],
                    "country_count": s["country_count"]})
    return out


# ----------------------- Recommendations -----------------------
@api.post("/recommendations")
async def create_recommendation(req: RecCreateReq, user: dict = Depends(current_user)):
    if req.category not in ("food", "experience", "stay", "getting_around"):
        raise HTTPException(status_code=400, detail="Invalid category")
    if not req.place_name.strip():
        raise HTTPException(status_code=400, detail="Place name required")
    # resolve city
    if req.city_id:
        city = await db.cities.find_one({"id": req.city_id}, {"_id": 0})
        if not city:
            raise HTTPException(status_code=404, detail="City not found")
    elif req.city_name:
        city = await upsert_city(req.city_name, req.country, req.country_code)
    else:
        raise HTTPException(status_code=400, detail="City is required")
    rec_id = str(uuid.uuid4())
    rec = {
        "id": rec_id, "user_id": user["id"], "city_id": city["id"],
        "place_name": req.place_name.strip(),
        "place_id": req.place_id, "place_address": req.place_address,
        "place_name_normalized": slugify(req.place_name),
        "category": req.category, "note": (req.note or "").strip(),
        "photo_url": req.photo_url, "created_at": iso(now_utc()),
    }
    await db.recommendations.insert_one(rec)
    # Auto-create a Trip entry for this city if not already present
    try:
        await db.user_trips.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"], "city_id": city["id"],
            "created_at": iso(now_utc()),
        })
    except Exception:
        pass  # already exists — unique index
    # Notify followers who have this city in their bucket list (saved_recs may be empty)
    try:
        followers_ids = user.get("followers", [])
        if followers_ids:
            async for plan in db.trip_plans.find({"user_id": {"$in": followers_ids}, "city_id": city["id"]}, {"_id": 0, "user_id": 1}).limit(500):
                await create_notification(plan["user_id"], "bucket_recs", actor_id=user["id"], payload={"city_id": city["id"], "city_name": city.get("name")})
    except Exception:
        pass
    rec.pop("_id", None)
    return {**rec, "city": city}


@api.patch("/recommendations/{rec_id}")
async def update_recommendation(rec_id: str, req: RecUpdateReq, user: dict = Depends(current_user)):
    rec = await db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Can only edit your own recommendations")
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if "place_name" in updates:
        updates["place_name_normalized"] = slugify(updates["place_name"])
    if updates:
        await db.recommendations.update_one({"id": rec_id}, {"$set": updates})
    r = await db.recommendations.find_one({"id": rec_id}, {"_id": 0})
    return r


@api.delete("/recommendations/{rec_id}")
async def delete_recommendation(rec_id: str, user: dict = Depends(current_user)):
    rec = await db.recommendations.find_one({"id": rec_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Can only delete your own recommendations")
    await db.recommendations.delete_one({"id": rec_id})
    # Also remove this rec from any trip plans
    await db.trip_plans.update_many(
        {"saved_recs.recommendation_id": rec_id},
        {"$pull": {"saved_recs": {"recommendation_id": rec_id},
                   "checked_recs": rec_id}}
    )
    return {"ok": True}


def _place_key(rec: dict) -> str:
    return rec.get("place_id") or f"name::{rec.get('place_name_normalized') or slugify(rec.get('place_name',''))}"


async def _user_saved_place_keys(user_id: str, city_id: str) -> set:
    plan = await db.trip_plans.find_one({"user_id": user_id, "city_id": city_id}, {"_id": 0})
    if not plan:
        return set()
    saved_rec_ids = [s["recommendation_id"] for s in plan.get("saved_recs", [])]
    if not saved_rec_ids:
        return set()
    keys = set()
    async for r in db.recommendations.find({"id": {"$in": saved_rec_ids}}, {"_id": 0}):
        keys.add(_place_key(r))
    return keys


@api.get("/cities/{city_id}/recommendations")
async def list_city_recommendations(city_id: str, category: Optional[str] = None,
                                    user: dict = Depends(current_user)):
    """Returns places (grouped if 2+ followed users recommended the same place).
    Excludes the current user's own recs — those belong on the user's profile."""
    following_ids = user.get("following", [])
    if not following_ids:
        return []
    query = {"city_id": city_id, "user_id": {"$in": following_ids}}
    if category and category != "all":
        query["category"] = category
    recs = []
    async for r in db.recommendations.find(query, {"_id": 0}).limit(500):
        recs.append(r)
    if not recs:
        return []
    # gather user info
    user_ids = list({r["user_id"] for r in recs})
    users = {u["id"]: public_user_brief(u) async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0})}
    # group by place key
    groups: dict = {}
    for r in recs:
        key = _place_key(r)
        groups.setdefault(key, []).append(r)
    # saved keys
    saved_keys = await _user_saved_place_keys(user["id"], city_id)
    out = []
    for key, items in groups.items():
        items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        first = items[0]
        contributors = [
            {**users[i["user_id"]], "rec_id": i["id"], "note": i.get("note"),
             "category": i.get("category"), "photo_url": i.get("photo_url"),
             "created_at": i.get("created_at")}
            for i in items if i["user_id"] in users
        ]
        out.append({
            "place_key": key,
            "place_name": first["place_name"],
            "place_id": first.get("place_id"),
            "place_address": first.get("place_address"),
            "category": first.get("category"),
            "photo_url": first.get("photo_url"),
            "is_saved": key in saved_keys,
            "contributors": contributors,
            "primary_rec_id": first["id"],
        })
    out.sort(key=lambda g: len(g["contributors"]), reverse=True)
    return out


@api.get("/users/{user_id}/cities/{city_id}/recommendations")
async def list_user_city_recs(user_id: str, city_id: str, category: Optional[str] = None,
                              user: dict = Depends(current_user)):
    query = {"user_id": user_id, "city_id": city_id}
    if category and category != "all":
        query["category"] = category
    out = []
    async for r in db.recommendations.find(query, {"_id": 0}).sort("created_at", -1):
        out.append(r)
    return out


# ----------------------- Trips (cities I've been to) -----------------------
@api.get("/trips")
async def list_trips(user: dict = Depends(current_user)):
    """Cities the user has been to (explicit trips + cities where they have recs)."""
    rec_city_ids = set()
    rec_counts: dict = {}
    async for r in db.recommendations.find({"user_id": user["id"]}, {"_id": 0, "city_id": 1}).limit(1000):
        rec_city_ids.add(r["city_id"])
        rec_counts[r["city_id"]] = rec_counts.get(r["city_id"], 0) + 1
    explicit = set()
    async for t in db.user_trips.find({"user_id": user["id"]}, {"_id": 0, "city_id": 1}).limit(500):
        explicit.add(t["city_id"])
    all_ids = list(rec_city_ids | explicit)
    if not all_ids:
        return []
    cities = {c["id"]: c async for c in db.cities.find({"id": {"$in": all_ids}}, {"_id": 0})}
    return [{
        "city_id": cid, "city": cities.get(cid),
        "rec_count": rec_counts.get(cid, 0),
    } for cid in all_ids if cid in cities]


@api.post("/trips")
async def add_trip(req: TripReq, user: dict = Depends(current_user)):
    if req.city_id:
        city = await db.cities.find_one({"id": req.city_id}, {"_id": 0})
        if not city:
            raise HTTPException(status_code=404, detail="City not found")
    elif req.city_name:
        city = await upsert_city(req.city_name, req.country, req.country_code)
    else:
        raise HTTPException(status_code=400, detail="city_id or city_name required")
    try:
        await db.user_trips.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"], "city_id": city["id"],
            "created_at": iso(now_utc()),
        })
    except Exception:
        pass  # already a trip — idempotent
    return {"city_id": city["id"], "city": city, "rec_count": 0}


@api.delete("/trips/{city_id}")
async def delete_trip(city_id: str, user: dict = Depends(current_user)):
    """Remove this city entirely from the user's profile.

    Cascades to: the user_trips entry, every recommendation the user added in that city,
    and any bucket-list/trip-plan entry for that city.  Other users' data is never touched.
    """
    uid = user["id"]
    await db.user_trips.delete_one({"user_id": uid, "city_id": city_id})
    rec_res = await db.recommendations.delete_many({"user_id": uid, "city_id": city_id})
    await db.trip_plans.delete_one({"user_id": uid, "city_id": city_id})
    return {"ok": True, "deleted_recommendations": rec_res.deleted_count}


# ----------------------- Trip Plans / Bucket List -----------------------
@api.get("/trip-plans")
async def list_trip_plans(user: dict = Depends(current_user)):
    cursor = db.trip_plans.find({"user_id": user["id"]}, {"_id": 0}).limit(200)
    plans = [p async for p in cursor]
    if not plans:
        return []
    city_ids = list({p["city_id"] for p in plans})
    cities = {c["id"]: c async for c in db.cities.find({"id": {"$in": city_ids}}, {"_id": 0})}
    return [{
        **p, "city": cities.get(p["city_id"]),
        "saved_count": len(p.get("saved_recs", [])),
        "checked_count": len(p.get("checked_recs", [])),
    } for p in plans]


@api.post("/trip-plans/bucket-list")
async def add_bucket_list(req: BucketListReq, user: dict = Depends(current_user)):
    if req.city_id:
        city = await db.cities.find_one({"id": req.city_id}, {"_id": 0})
        if not city:
            raise HTTPException(status_code=404, detail="City not found")
    elif req.city_name:
        city = await upsert_city(req.city_name, req.country, req.country_code)
    else:
        raise HTTPException(status_code=400, detail="city_id or city_name required")
    existing = await db.trip_plans.find_one({"user_id": user["id"], "city_id": city["id"]}, {"_id": 0})
    if existing:
        return {**existing, "city": city}
    plan = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "city_id": city["id"],
        "saved_recs": [], "checked_recs": [],
        "created_at": iso(now_utc()),
    }
    await db.trip_plans.insert_one(plan)
    plan.pop("_id", None)
    return {**plan, "city": city}


@api.delete("/trip-plans/{city_id}")
async def delete_trip_plan(city_id: str, user: dict = Depends(current_user)):
    await db.trip_plans.delete_one({"user_id": user["id"], "city_id": city_id})
    return {"ok": True}


@api.get("/trip-plans/{city_id}")
async def get_trip_plan(city_id: str, user: dict = Depends(current_user)):
    plan = await db.trip_plans.find_one({"user_id": user["id"], "city_id": city_id}, {"_id": 0})
    if not plan:
        # Implicit empty plan
        city = await db.cities.find_one({"id": city_id}, {"_id": 0})
        if not city:
            raise HTTPException(status_code=404, detail="City not found")
        return {"id": None, "user_id": user["id"], "city_id": city_id,
                "saved_recs": [], "checked_recs": [], "city": city, "saved": []}
    city = await db.cities.find_one({"id": city_id}, {"_id": 0})
    # populate saved recs
    rec_ids = [s["recommendation_id"] for s in plan.get("saved_recs", [])]
    recs = []
    if rec_ids:
        async for r in db.recommendations.find({"id": {"$in": rec_ids}}, {"_id": 0}):
            recs.append(r)
        # attach user info
        user_ids = list({r["user_id"] for r in recs})
        users = {u["id"]: public_user_brief(u) async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0})}
        recs = [{**r, "by_user": users.get(r["user_id"])} for r in recs]
    return {**plan, "city": city, "saved": recs}


@api.post("/trip-plans/{city_id}/save")
async def save_rec_to_trip(city_id: str, req: SaveRecReq, user: dict = Depends(current_user)):
    rec = await db.recommendations.find_one({"id": req.recommendation_id}, {"_id": 0})
    if not rec or rec["city_id"] != city_id:
        raise HTTPException(status_code=404, detail="Recommendation not found in this city")
    plan = await db.trip_plans.find_one({"user_id": user["id"], "city_id": city_id})
    now_iso = iso(now_utc())
    if not plan:
        plan = {
            "id": str(uuid.uuid4()), "user_id": user["id"], "city_id": city_id,
            "saved_recs": [{"recommendation_id": rec["id"], "original_user_id": rec["user_id"]}],
            "checked_recs": [],
            "created_at": now_iso,
        }
        await db.trip_plans.insert_one(plan)
    else:
        # check duplicate by place key
        existing_ids = [s["recommendation_id"] for s in plan.get("saved_recs", [])]
        existing_recs = []
        if existing_ids:
            async for r in db.recommendations.find({"id": {"$in": existing_ids}}, {"_id": 0}):
                existing_recs.append(r)
        existing_keys = {_place_key(r) for r in existing_recs}
        if _place_key(rec) in existing_keys:
            return {"ok": True, "already_saved": True}
        await db.trip_plans.update_one(
            {"user_id": user["id"], "city_id": city_id},
            {"$push": {"saved_recs": {"recommendation_id": rec["id"], "original_user_id": rec["user_id"]}}}
        )
    return {"ok": True}


@api.post("/trip-plans/{city_id}/unsave")
async def unsave_rec(city_id: str, req: SaveRecReq, user: dict = Depends(current_user)):
    rec = await db.recommendations.find_one({"id": req.recommendation_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    target_key = _place_key(rec)
    plan = await db.trip_plans.find_one({"user_id": user["id"], "city_id": city_id})
    if not plan:
        return {"ok": True}
    saved = plan.get("saved_recs", [])
    if not saved:
        return {"ok": True}
    existing_ids = [s["recommendation_id"] for s in saved]
    existing_recs = []
    async for r in db.recommendations.find({"id": {"$in": existing_ids}}, {"_id": 0}):
        existing_recs.append(r)
    to_remove_rec_ids = [r["id"] for r in existing_recs if _place_key(r) == target_key]
    if to_remove_rec_ids:
        await db.trip_plans.update_one(
            {"user_id": user["id"], "city_id": city_id},
            {"$pull": {"saved_recs": {"recommendation_id": {"$in": to_remove_rec_ids}},
                       "checked_recs": {"$in": to_remove_rec_ids}}}
        )
    return {"ok": True}


@api.post("/trip-plans/{city_id}/check")
async def check_rec(city_id: str, req: CheckRecReq, user: dict = Depends(current_user)):
    op = "$addToSet" if req.checked else "$pull"
    res = await db.trip_plans.update_one(
        {"user_id": user["id"], "city_id": city_id},
        {op: {"checked_recs": req.recommendation_id}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip plan not found")
    # If newly checked, return a prompt if user has no recs in this city yet
    has_own = await db.recommendations.find_one({"user_id": user["id"], "city_id": city_id})
    prompt = (req.checked and not has_own)
    return {"ok": True, "prompt_add_to_trips": prompt}


# ----------------------- Google Places proxy -----------------------
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://freccos.com")


@api.get("/places/autocomplete")
async def places_autocomplete(q: str = Query(..., min_length=1),
                              user: dict = Depends(current_user)):
    if not GOOGLE_PLACES_KEY:
        return {"suggestions": []}
    try:
        # Use new Places API (Autocomplete (New))
        r = requests.post(
            "https://places.googleapis.com/v1/places:autocomplete",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
                # Pass a Referer so the key's HTTP referer restriction (if any) matches.
                "Referer": FRONTEND_URL,
            },
            json={"input": q},
            timeout=10,
        )
        if r.status_code != 200:
            logger.warning(f"Places autocomplete {r.status_code}: {r.text[:200]}")
            return {"suggestions": []}
        data = r.json()
        out = []
        for s in data.get("suggestions", []):
            pp = s.get("placePrediction") or {}
            pid = pp.get("placeId")
            text_obj = pp.get("text", {})
            txt_full = text_obj.get("text") or ""
            structured = pp.get("structuredFormat") or {}
            main_text = (structured.get("mainText") or {}).get("text") or txt_full
            secondary = (structured.get("secondaryText") or {}).get("text") or ""
            out.append({"place_id": pid, "main_text": main_text,
                       "secondary_text": secondary, "full_text": txt_full})
        return {"suggestions": out}
    except Exception as e:
        logger.error(f"Places autocomplete error: {e}")
        return {"suggestions": []}


@api.get("/places/details/{place_id}")
async def places_details(place_id: str, user: dict = Depends(current_user)):
    if not GOOGLE_PLACES_KEY:
        raise HTTPException(status_code=503, detail="Places API not configured")
    try:
        r = requests.get(
            f"https://places.googleapis.com/v1/places/{place_id}",
            headers={
                "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
                "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,rating,priceLevel,currentOpeningHours,regularOpeningHours,photos,googleMapsUri",
                "Referer": FRONTEND_URL,
            },
            timeout=10,
        )
        if r.status_code != 200:
            logger.warning(f"Place details {r.status_code}: {r.text[:200]}")
            raise HTTPException(status_code=400, detail="Couldn't fetch place details")
        data = r.json()
        display = (data.get("displayName") or {}).get("text") or ""
        formatted = data.get("formattedAddress") or ""
        # Extract city and country
        city = ""; country = ""; country_code = ""
        for c in data.get("addressComponents", []):
            types = c.get("types", [])
            if "locality" in types:
                city = c.get("longText") or c.get("shortText") or ""
            elif not city and ("administrative_area_level_2" in types or "postal_town" in types):
                city = c.get("longText") or c.get("shortText") or ""
            if "country" in types:
                country = c.get("longText") or ""
                country_code = c.get("shortText") or ""
        # Opening status
        opening = data.get("currentOpeningHours") or data.get("regularOpeningHours") or {}
        open_now = opening.get("openNow")
        # First photo name (we'll proxy bytes via /api/places/photo)
        photos = data.get("photos") or []
        photo_name = photos[0].get("name") if photos else None
        return {
            "place_id": data.get("id") or place_id,
            "display_name": display,
            "formatted_address": formatted,
            "city": city, "country": country, "country_code": country_code,
            "rating": data.get("rating"),
            "price_level": data.get("priceLevel"),
            "open_now": open_now,
            "google_maps_uri": data.get("googleMapsUri"),
            "photo_name": photo_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Place details error: {e}")
        raise HTTPException(status_code=400, detail="Couldn't fetch place details")


@api.get("/places/photo")
async def places_photo(name: str = Query(..., description="Google Places photo name e.g. places/X/photos/Y"),
                      max_width: int = 1024, user: dict = Depends(current_user)):
    """Proxy for Google Places photo bytes — keeps the API key server-side."""
    if not GOOGLE_PLACES_KEY:
        raise HTTPException(status_code=503, detail="Places API not configured")
    try:
        r = requests.get(
            f"https://places.googleapis.com/v1/{name}/media",
            params={"maxWidthPx": max_width, "skipHttpRedirect": "false"},
            headers={"X-Goog-Api-Key": GOOGLE_PLACES_KEY, "Referer": FRONTEND_URL},
            timeout=15, allow_redirects=True,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="Photo not found")
        return Response(content=r.content, media_type=r.headers.get("Content-Type", "image/jpeg"))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Place photo error: {e}")
        raise HTTPException(status_code=404, detail="Photo not found")


# ----------------------- Place detail (Freccos data) -----------------------
def _place_match_filter(place_id: Optional[str], place_name: str) -> dict:
    if place_id:
        return {"place_id": place_id}
    return {"place_name_normalized": slugify(place_name)}


@api.get("/places/recommendations")
async def place_recommendations(
    place_id: Optional[str] = None,
    place_name: Optional[str] = None,
    city_id: Optional[str] = None,
    user: dict = Depends(current_user),
):
    """All visible friend recommendations for a given place (matching by place_id or normalised name)."""
    if not place_id and not place_name:
        raise HTTPException(status_code=400, detail="place_id or place_name required")
    following_ids = user.get("following", []) + [user["id"]]
    blocked = set(user.get("blocked", []))
    q: dict = {"user_id": {"$in": following_ids}}
    if place_id:
        q["place_id"] = place_id
    else:
        q["place_name_normalized"] = slugify(place_name)
    if city_id:
        q["city_id"] = city_id
    recs = []
    async for r in db.recommendations.find(q, {"_id": 0}).sort("created_at", -1).limit(200):
        if r["user_id"] in blocked:
            continue
        recs.append(r)
    user_ids = list({r["user_id"] for r in recs})
    users = {}
    async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).limit(200):
        users[u["id"]] = public_user_brief(u)
    save_count = await db.trip_plans.count_documents({"saved_recs.recommendation_id": {"$in": [r["id"] for r in recs]}})
    return {
        "contributors": [
            {"id": r["id"], "user": users.get(r["user_id"]), "note": r.get("note"),
             "category": r.get("category"), "photo_url": r.get("photo_url"),
             "created_at": r.get("created_at")}
            for r in recs if r["user_id"] in users
        ],
        "save_count": save_count,
    }


# ----------------------- Mount router + CORS -----------------------
app.include_router(api)

# CORS — when CORS_ORIGINS is "*" we use allow_origin_regex so cookies (credentials)
# still work (browsers forbid allow_origins=["*"] together with allow_credentials=True).
_wildcard = (not CORS_ORIGINS) or "*" in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if _wildcard else CORS_ORIGINS,
    allow_origin_regex=".*" if _wildcard else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()

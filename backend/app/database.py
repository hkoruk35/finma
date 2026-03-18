"""
FinMA Database Layer — Supabase PostgreSQL
Binlerce eşzamanlı kullanıcı için tasarlanmış CRUD helper'lar.

Supabase credentials yoksa graceful fallback ile in-memory çalışır.
"""

import logging
import json
import urllib.request
from typing import Optional, List
from datetime import datetime
from app.config import get_settings

logger = logging.getLogger(__name__)

# ─── Supabase Client Singleton ───

_supabase_client = None
_initialized = False


def get_supabase():
    """Supabase client singleton — Hata durumunda (bağımlılık eksikliği vb.) None döner"""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()
    url = settings.supabase_url
    key = settings.supabase_key

    if not url or not key:
        logger.warning("⚠️  Supabase credentials bulunamadı — in-memory fallback aktif")
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(url, key)
        logger.info("✅ Supabase bağlantısı başarılı")
        return _supabase_client
    except (ImportError, ModuleNotFoundError) as e:
        logger.warning(f"🔔 Supabase kütüphanesi veya bağımlılığı (httpx) eksik: {e}. In-memory modda devam ediliyor.")
        return None
    except Exception as e:
        logger.error(f"❌ Supabase bağlantı hatası: {e}")
        return None


def is_db_available() -> bool:
    """Supabase bağlantısı aktif mi?"""
    return get_supabase() is not None


# ═══════════════════════════════════════════
# USERS TABLE CRUD
# ═══════════════════════════════════════════

class UsersDB:
    """
    users tablosu CRUD operasyonları.
    Supabase yoksa in-memory dict kullanır.
    """

    # In-memory fallback
    _memory: dict = {}

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def get_by_username(cls, username: str) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("users").select("*").eq("username", username).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_by_username hatası: {e}")
                return cls._memory.get(username)
        return cls._memory.get(username)

    @classmethod
    def get_by_email(cls, email: str) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("users").select("*").eq("email", email).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_by_email hatası: {e}")
                # fallback: search memory
                for u in cls._memory.values():
                    if u.get("email") == email:
                        return u
                return None
        # memory fallback
        for u in cls._memory.values():
            if u.get("email") == email:
                return u
        return None

    @classmethod
    def get_by_id(cls, user_id: str) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("users").select("*").eq("id", user_id).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_by_id hatası: {e}")
                return None
        # memory fallback
        for u in cls._memory.values():
            if u.get("id") == user_id:
                return u
        return None

    @classmethod
    def create(cls, user_data: dict) -> dict:
        sb = cls._sb()
        if sb:
            try:
                # Supabase'de id auto-generated (UUID)
                insert_data = {k: v for k, v in user_data.items() if k != "id"}
                result = sb.table("users").insert(insert_data).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                raise Exception("Insert sonucu boş")
            except Exception as e:
                logger.error(f"DB create user hatası: {e}")
                # fallback to memory
                cls._memory[user_data["username"]] = user_data
                return user_data
        # memory
        cls._memory[user_data["username"]] = user_data
        return user_data

    @classmethod
    def update(cls, username: str, updates: dict) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("users").update(updates).eq("username", username).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB update user hatası: {e}")
                if username in cls._memory:
                    cls._memory[username].update(updates)
                    return cls._memory[username]
                return None
        if username in cls._memory:
            cls._memory[username].update(updates)
            return cls._memory[username]
        return None

    @classmethod
    def get_all(cls, limit: int = 100, offset: int = 0) -> List[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("users").select("*").range(offset, offset + limit - 1).order("created_at", desc=True).execute()
                return result.data or []
            except Exception as e:
                logger.error(f"DB get_all users hatası: {e}")
                return list(cls._memory.values())[:limit]
        return list(cls._memory.values())[:limit]

    @classmethod
    def count(cls) -> int:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("users").select("id", count="exact").execute()
                return result.count or 0
            except Exception:
                return len(cls._memory)
        return len(cls._memory)


# ═══════════════════════════════════════════
# TRADES TABLE CRUD
# ═══════════════════════════════════════════

class TradesDB:
    """
    trades tablosu CRUD operasyonları.
    user_id ile kullanıcıya özel trade'ler.
    """

    _memory: List[dict] = []

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def get_all(cls, user_id: Optional[str] = None, status: Optional[str] = None) -> List[dict]:
        sb = cls._sb()
        if sb:
            try:
                query = sb.table("trades").select("*")
                if user_id:
                    query = query.eq("user_id", user_id)
                if status:
                    query = query.eq("status", status.upper())
                query = query.order("created_at", desc=True)
                result = query.execute()
                return result.data or []
            except Exception as e:
                logger.error(f"DB get_all trades hatası: {e}")
                return cls._filter_memory(user_id, status)
        return cls._filter_memory(user_id, status)

    @classmethod
    def _filter_memory(cls, user_id: Optional[str], status: Optional[str]) -> List[dict]:
        trades = cls._memory
        if user_id:
            trades = [t for t in trades if t.get("user_id") == user_id]
        if status:
            trades = [t for t in trades if t.get("status", "").upper() == status.upper()]
        return trades

    @classmethod
    def get_by_id(cls, trade_id: str) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("trades").select("*").eq("id", trade_id).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_by_id trade hatası: {e}")
                for t in cls._memory:
                    if t.get("id") == trade_id:
                        return t
                return None
        for t in cls._memory:
            if t.get("id") == trade_id:
                return t
        return None

    @classmethod
    def create(cls, trade_data: dict) -> dict:
        sb = cls._sb()
        if sb:
            try:
                insert_data = {k: v for k, v in trade_data.items() if k != "id"}
                result = sb.table("trades").insert(insert_data).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                raise Exception("Insert sonucu boş")
            except Exception as e:
                logger.error(f"DB create trade hatası: {e}")
                cls._memory.append(trade_data)
                return trade_data
        cls._memory.append(trade_data)
        return trade_data

    @classmethod
    def update(cls, trade_id: str, updates: dict) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("trades").update(updates).eq("id", trade_id).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB update trade hatası: {e}")
                for t in cls._memory:
                    if t.get("id") == trade_id:
                        t.update(updates)
                        return t
                return None
        for t in cls._memory:
            if t.get("id") == trade_id:
                t.update(updates)
                return t
        return None

    @classmethod
    def count_open(cls, user_id: Optional[str] = None) -> int:
        sb = cls._sb()
        if sb:
            try:
                query = sb.table("trades").select("id", count="exact").eq("status", "OPEN")
                if user_id:
                    query = query.eq("user_id", user_id)
                result = query.execute()
                return result.count or 0
            except Exception:
                return len([t for t in cls._memory if t.get("status") == "OPEN"])
        return len([t for t in cls._memory if t.get("status") == "OPEN"])


# ═══════════════════════════════════════════
# SIGNALS TABLE CRUD
# ═══════════════════════════════════════════

class SignalsDB:
    """
    signals tablosu — bot sinyal raporları geçmişi.
    """

    _memory: List[dict] = []

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def save_report(cls, report: dict) -> bool:
        """Tam sinyal raporunu kaydet"""
        sb = cls._sb()
        if sb:
            try:
                # Her aday için ayrı satır
                rows = []
                for candidate in report.get("candidates", []):
                    rows.append({
                        "bot_name": report.get("bot_name", "unknown"),
                        "timestamp": report.get("timestamp"),
                        "market_regime": report.get("market_regime"),
                        "vix_level": report.get("vix_level"),
                        "ticker": candidate.get("ticker"),
                        "score": candidate.get("score"),
                        "price": candidate.get("price"),
                        "action": candidate.get("action"),
                        "entry_zone": candidate.get("entry_zone"),
                        "stop_loss": candidate.get("stop_loss"),
                        "target": candidate.get("target"),
                        "potential_pct": candidate.get("potential_pct"),
                        "sector": candidate.get("sector"),
                        "trend_phase": candidate.get("trend_phase"),
                        "rvol": candidate.get("rvol"),
                        "notes": candidate.get("notes"),
                    })

                if rows:
                    sb.table("signals").insert(rows).execute()
                    logger.info(f"✅ {len(rows)} sinyal kaydedildi")
                return True
            except Exception as e:
                logger.error(f"DB save_report hatası: {e}")
                cls._memory.append(report)
                return False
        cls._memory.append(report)
        return True

    @classmethod
    def get_history(cls, limit: int = 10, ticker: Optional[str] = None) -> List[dict]:
        sb = cls._sb()
        if sb:
            try:
                query = sb.table("signals").select("*").order("created_at", desc=True).limit(limit)
                if ticker:
                    query = query.eq("ticker", ticker.upper())
                result = query.execute()
                return result.data or []
            except Exception as e:
                logger.error(f"DB get_history hatası: {e}")
                return cls._memory[:limit]
        return cls._memory[:limit]

    @classmethod
    def get_latest_report(cls) -> Optional[dict]:
        """Supabase'den en son bot raporunu tam format olarak getir"""
        sb = cls._sb()
        if not sb:
            return None
        try:
            # Son kaydedilen timestamp'i bul
            latest = sb.table("signals").select("timestamp, bot_name, market_regime, vix_level").order("created_at", desc=True).limit(1).execute()
            if not latest.data:
                return None

            ts = latest.data[0].get("timestamp")
            if not ts:
                return None

            # O timestamp'e ait tüm adayları getir
            result = sb.table("signals").select("*").eq("timestamp", ts).order("score", desc=True).execute()
            rows = result.data or []
            if not rows:
                return None

            meta = rows[0]
            candidates = []
            for r in rows:
                candidates.append({
                    "ticker": r.get("ticker"),
                    "score": r.get("score"),
                    "price": r.get("price"),
                    "action": r.get("action"),
                    "entry_zone": r.get("entry_zone"),
                    "stop_loss": r.get("stop_loss"),
                    "target": r.get("target"),
                    "potential_pct": r.get("potential_pct"),
                    "sector": r.get("sector"),
                    "trend_phase": r.get("trend_phase"),
                    "rvol": r.get("rvol"),
                    "notes": r.get("notes"),
                })

            return {
                "timestamp": ts,
                "bot_name": meta.get("bot_name", "swing112"),
                "market_regime": meta.get("market_regime", "Bull"),
                "vix_level": meta.get("vix_level", 20.0),
                "candidates": candidates,
            }
        except Exception as e:
            logger.error(f"DB get_latest_report hatası: {e}")
            return None

    @classmethod
    def get_unique_tickers(cls) -> List[str]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("signals").select("ticker").execute()
                return list(set(r["ticker"] for r in (result.data or [])))
            except Exception:
                return []
        return []


# ═══════════════════════════════════════════
# PORTFOLIO SNAPSHOTS TABLE CRUD
# ═══════════════════════════════════════════

class SnapshotsDB:
    """
    portfolio_snapshots tablosu — günlük NAV/PnL snapshot'ları.
    """

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def save_snapshot(cls, user_id: str, snapshot: dict) -> bool:
        sb = cls._sb()
        if sb:
            try:
                data = {**snapshot, "user_id": user_id}
                sb.table("portfolio_snapshots").insert(data).execute()
                return True
            except Exception as e:
                logger.error(f"DB save_snapshot hatası: {e}")
                return False
        return False

    @classmethod
    def get_latest(cls, user_id: str) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = (
                    sb.table("portfolio_snapshots")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_latest snapshot hatası: {e}")
                return None
        return None

    @classmethod
    def get_history(cls, user_id: str, days: int = 30) -> List[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = (
                    sb.table("portfolio_snapshots")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .limit(days)
                    .execute()
                )
                return result.data or []
            except Exception:
                return []
        return []


# ═══════════════════════════════════════════
# INVITE CODES TABLE CRUD
# ═══════════════════════════════════════════

class InviteCodesDB:
    """
    invite_codes tablosu — Premium üyelik davet kodları.
    """

    _memory: List[dict] = []

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def create(cls, data: dict) -> dict:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("invite_codes").insert(data).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
            except Exception as e:
                logger.error(f"DB create invite_code hatası: {e}")
                cls._memory.append(data)
                return data
        cls._memory.append(data)
        return data

    @classmethod
    def get_by_code(cls, code: str) -> Optional[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("invite_codes").select("*").eq("code", code).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_by_code hatası: {e}")
                for ic in cls._memory:
                    if ic.get("code") == code:
                        return ic
                return None
        for ic in cls._memory:
            if ic.get("code") == code:
                return ic
        return None

    @classmethod
    def mark_used(cls, code: str, user_id: str) -> bool:
        sb = cls._sb()
        if sb:
            try:
                sb.table("invite_codes").update({
                    "used_by": user_id,
                    "used_at": datetime.utcnow().isoformat(),
                }).eq("code", code).execute()
                return True
            except Exception as e:
                logger.error(f"DB mark_used hatası: {e}")
                return False
        for ic in cls._memory:
            if ic.get("code") == code:
                ic["used_by"] = user_id
                ic["used_at"] = datetime.utcnow().isoformat()
                return True
        return False

    @classmethod
    def get_all(cls, limit: int = 100) -> List[dict]:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("invite_codes").select("*").order("created_at", desc=True).limit(limit).execute()
                return result.data or []
            except Exception as e:
                logger.error(f"DB get_all invite_codes hatası: {e}")
                return cls._memory[:limit]
        return cls._memory[:limit]
# ═══════════════════════════════════════════
# MARKET INTELLIGENCE TABLE CRUD
# ═══════════════════════════════════════════

class IntelligenceDB:
    """
    market_intelligence tablosu — AI tarafından üretilen piyasa raporları.
    """

    _memory: List[dict] = []

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def save_report(cls, payload: dict) -> bool:
        """Yeni bir zeka raporu kaydet"""
        sb = cls._sb()
        if sb:
            try:
                sb.table("market_intelligence").insert({
                    "payload": payload
                }).execute()
                logger.info("✅ Market Intelligence raporu kaydedildi")
                return True
            except Exception as e:
                logger.error(f"DB save_report intelligence hatası: {e}")
                cls._memory.append({"payload": payload, "created_at": datetime.utcnow().isoformat()})
                return False
        cls._memory.append({"payload": payload, "created_at": datetime.utcnow().isoformat()})
        return True

    @classmethod
    def get_latest(cls) -> Optional[dict]:
        """En son yayınlanan raporu getir"""
        sb = cls._sb()
        if sb:
            try:
                result = (
                    sb.table("market_intelligence")
                    .select("*")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data and len(result.data) > 0:
                    return result.data[0]
                return None
            except Exception as e:
                logger.error(f"DB get_latest intelligence hatası: {e}")
                return cls._memory[-1] if cls._memory else None
        return cls._memory[-1] if cls._memory else None
# ═══════════════════════════════════════════
# PORTFOLIO SETTINGS TABLE CRUD
# ═══════════════════════════════════════════

class PortfolioSettingsDB:
    """
    portfolio_settings tablosu — Kullanıcı bazlı bütçe/ayarlar.
    """

    _memory: dict = {}  # {user_id: {"initial_capital": float}}

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def get_initial_capital(cls, user_id: str) -> float:
        sb = cls._sb()
        if sb:
            try:
                result = sb.table("portfolio_settings").select("initial_capital").eq("user_id", user_id).execute()
                if result.data and len(result.data) > 0:
                    return float(result.data[0].get("initial_capital", 10000.0))
            except Exception as e:
                logger.error(f"DB get_initial_capital hatası: {e}")
        
        # Fallback to memory
        if user_id in cls._memory:
            return cls._memory[user_id].get("initial_capital", 10000.0)
        return 10000.0

    @classmethod
    def set_initial_capital(cls, user_id: str, amount: float) -> bool:
        sb = cls._sb()
        if sb:
            try:
                # Upsert (Ekle veya Güncelle)
                data = {"user_id": user_id, "initial_capital": amount}
                result = sb.table("portfolio_settings").upsert(data, on_conflict="user_id").execute()
                if result.data:
                    return True
            except Exception as e:
                logger.error(f"DB set_initial_capital hatası: {e}")
        
        # ═══════════════════════════════════════════
# MARKET INSIDER TABLE CRUD
# ═══════════════════════════════════════════

class InsiderDB:
    """
    market_insider tablosu — En son insider işlemleri (toplu).
    """

    _memory: List[dict] = []

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def save_trades(cls, trades: List[dict]) -> bool:
        """Yeni insider işlemlerini kaydet (eskiyi temizler)"""
        sb = cls._sb()
        if sb:
            try:
                # Opsiyonel: Eski verileri temizleyip yenilerini ekle (güncel tablo için)
                sb.table("market_insider").delete().neq("symbol", "NONE_XYZ").execute()
                if trades:
                    # Supabase'e gönderirken verinin tipini kontrol et
                    formatted_trades = []
                    for t in trades:
                        formatted_trades.append({
                            "symbol": str(t.get("symbol", "")),
                            "owner": str(t.get("owner", "")),
                            "relationship": str(t.get("relationship", "")),
                            "transaction": str(t.get("transaction", "")),
                            "date": str(t.get("date", "")),
                            "cost": float(t.get("cost", 0)) if t.get("cost") else 0,
                            "shares": int(t.get("shares", 0)) if t.get("shares") else 0,
                            "value": float(t.get("value", 0)) if t.get("value") else 0,
                            "shares_total": int(t.get("shares_total", 0)) if t.get("shares_total") else 0,
                            "sec_form_4_url": str(t.get("sec_form_4_url", ""))
                        })
                    sb.table("market_insider").insert(formatted_trades).execute()
                logger.info(f"✅ {len(trades)} insider işlemi kaydedildi")
                return True
            except Exception as e:
                logger.error(f"DB save_trades insider hatası: {e}")
                cls._memory = trades
                return False
        cls._memory = trades
        return True

    @classmethod
    def get_latest(cls, limit: int = 100) -> List[dict]:
        """En son insider işlemlerini getir"""
        sb = cls._sb()
        if sb:
            try:
                # 'created_at' yerine 'date' veya ID'ye göre çekmek daha mantıklı olabilir 
                # ama en son kaydedilenleri istiyoruz
                result = sb.table("market_insider").select("*").order("date", desc=True).limit(limit).execute()
                return result.data or []
            except Exception as e:
                logger.error(f"DB get_latest insider hatası: {e}")
                return cls._memory[:limit]
        return cls._memory[:limit]


class NewsDB:
    """
    market_news tablosu — Genel piyasa ve ekonomi haberleri.
    """

    _memory: List[dict] = []

    @staticmethod
    def _sb():
        return get_supabase()

    @classmethod
    def save_news(cls, news_list: List[dict]) -> bool:
        """Yeni haberleri kaydet (mükerrer kontrolü ile)"""
        sb = cls._sb()
        if sb:
            try:
                if not news_list:
                    return True
                
                formatted = []
                for n in news_list:
                    formatted.append({
                        "title": str(n.get("title", "")),
                        "url": str(n.get("url", "")),
                        "publisher": str(n.get("publisher", "Unknown")),
                        "date": str(n.get("date", "")),
                        "ticker": str(n.get("ticker", "MARKET")),
                        "impact": str(n.get("impact", "neutral")),
                        "category": str(n.get("category", "market")),
                        "lang": str(n.get("lang", "en"))
                    })
                
                # Mükerrer kontrolü (son 100 başlık)
                existing = sb.table("market_news").select("title").order("created_at", desc=True).limit(100).execute()
                titles = set(e["title"] for e in (existing.data or []))
                
                to_insert = [n for n in formatted if n["title"] not in titles]
                
                if to_insert:
                    sb.table("market_news").insert(to_insert).execute()
                return True
            except Exception as e:
                logger.error(f"DB save_news hatası: {e}")
                return False
        
        cls._memory.extend(news_list)
        cls._memory = cls._memory[-200:]
        return True

    @classmethod
    def get_latest(cls, limit: int = 50, category: Optional[str] = None) -> List[dict]:
        """En son haberleri getir"""
        sb = cls._sb()
        if sb:
            try:
                query = sb.table("market_news").select("*").order("date", desc=True).limit(limit)
                if category:
                    query = query.eq("category", category.lower())
                result = query.execute()
                return result.data or []
            except Exception as e:
                logger.error(f"DB get_latest_news hatası: {e}")
                return cls._memory[:limit]
        return cls._memory[:limit]

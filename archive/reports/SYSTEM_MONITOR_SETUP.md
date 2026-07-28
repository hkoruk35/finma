# 2 SAATLİK SİSTEM SAĞLIK KONTROLÜ

## 📋 Açıklama

Güncellenmiş **site_health_checker.py** botunun özellikleri:

### ✅ Kontrol Noktaları (Her 1-2 Saatte)

1. **📊 TEMEL VERİ AKIŞI**
   - master.json, swing_all_picks.json, performance.json, sectors.json
   - Dosya güncelleme zamanı ve kayıt sayıları

2. **🤖 BOT ÇALIŞMA DURUMU**
   - Son 24 saatteki log dosyalarını tarama
   - Hata ve uyarı sayımı

3. **📄 HİSSE DETAY SAYFALARI**
   - frontend/public/data/ dizinindeki JSON dosyaları
   - Analiz dosyası sayısı ve güncelleme zamanı

4. **📈 SEKTÖR ANALİZİ**
   - Sektör dosyası güncelleme kontası
   - Sektör sayısı ve veri bütünlüğü

5. **🔗 VERİ TUTARLILUĞU & GRAFİK DOĞRULMASI**
   - Master ve Sector Analysis dosyaları karşılaştırması
   - Hisse sayılarının uyumluluğu
   - Chart verisi doğrulaması

6. **⚡ CANLI FİYAT SİNCHRONİZASYONU**
   - Swing picks ilk 3 hissenin yfinance ile fiyat kontrolü
   - Fiyat farkı analiz (< 1.0 fark kabul edilir)

7. **🌐 SAYFA ERİŞİLEBİLİRLİĞİ**
   - Ana sayfalar, sektör sayfaları, hisse detay sayfalarının HTTP status kontolü
   - Zaman aşımı ve bağlantı hatası tespiti

8. **👥 ÜYE İSTATİSTİKLERİ**
   - Toplam üye, ücretli/ücretsiz üye sayıları
   - master.json'dan tahmin (API entegrasyonu için hazır)

## 🚀 Nasıl Çalıştırılır

### Manuel Çalıştırma
```bash
python3 site_health_checker.py
```

### Otomatik Zamanlayıcı (hourly_bot.py)
```bash
python3 hourly_bot.py
```

**hourly_bot.py Şeması:**
- **Saat 1, 3, 5, 7, ... (Tek saatler):** Performance güncellemesi
- **Saat 2, 4, 6, 8, ... (Çift saatler):** SİSTEM SAĞLIK KONTORÜ

Yani her 2 saatte bir sistem kontorü çalışır, arası saatlerde performance güncellenir.

## 📊 Rapor Özeti

Rapor Telegram'a otomatik gönderilir (TELEGRAM_CHAT_ID konfigüre edilmişse).

Rapor Durumları:
- 🌟 **MÜKEMMEL** - Tüm kontroller başarılı
- ⚠️ **TAMİNKAR** - Bazı uyarılar var, inceleme gerekli
- 🚨 **KRİTİK HATA** - Kritik sorunlar tespit edildi

## 📝 Log Dosyaları

```
logs/
├── site_health_checker.log      (site_health_checker.py çıktıları)
├── system_health_monitor.log    (varsa)
├── run_all_bots.log             (run_all_bots.py)
├── bogaai_YYYY-MM-DD.log        (finma_bot.py)
└── ...
```

## ⚙️ Windows Task Scheduler Ayarı

**hourly_bot.py'yi Windows'ta otomatik çalıştırmak için:**

1. Task Scheduler açın (taskmgr veya "Görev Zamanlayıcı")
2. **"Temel Görev Oluştur"** seçin
3. **Adı:** `BOGA AI 2H Monitor`
4. **Tetikleyici:** Bilgisayar başlatıldığında
5. **Eylem:** Başlat Programı
   - Program: `C:\Users\afksm\AppData\Local\Microsoft\WindowsApps\python3.exe`
   - Bağımsız Değişkenler: `C:\Users\afksm\finma\.claude\worktrees\sleepy-driscoll\hourly_bot.py`
   - Başlangıç Dizini: `C:\Users\afksm\finma\.claude\worktrees\sleepy-driscoll`
6. **Koşullar:** Güç bağlantısı varsa çalıştır

## 🔧 Konfigürasyon

### Telegram
- `TELEGRAM_API_KEY`: Bot token
- `TELEGRAM_CHAT_ID`: Hedef chat ID

### Zaman Dilimi
- `NY_TZ`: America/New_York (borsanın saati)

## 📈 Örnek Rapor Çıktısı

```
🔍 BOGA AI 2 SAATLİK SİSTEM SAĞLIK RAPORU
📅 2026-04-14 21:33 NY
==================================================
📊 1. TEMEL VERİ AKIŞI:
• Homepage (Master): ✅ 21:12 | 0 Kayıt
• Swing Picks: ✅ 21:12 | 10 Kayıt
• Performance: ✅ 21:12 | 0 Kayıt
• Sectors: ✅ 21:12 | 0 Kayıt

🤖 2. BOT ÇALIŞMA DURUMU:
• ✅ 0 Hata (1 log)

📄 3. HİSSE DETAY SAYFALARI:
• ✅ 2 Analiz (Son: 14 Apr 21:12)

📈 4. SEKTÖR ANALİZİ:
• ✅ 21:12 | 0 Kayıt

🔗 5. VERİ TUTARLILUĞU & GRAFİK DOĞRULMASI:
• ✅ Veri Tutarlılığı

⚡ 6. CANLI FİYAT SİNCHRONİZASYONU:
• ✅ Fiyat Senkronu: 3/3 Tamam

🌐 7. SAYFA ERİŞİLEBİLİRLİĞİ:
• ⚠️ 3/4 Sayfa Aktif

👥 8. ÜYE İSTATİSTİKLERİ:
• ⚠️ Üye verileri master.json'da yok

==================================================
⚠️ SİSTEM DURUMU: TAMİNKAR (İNCELEME GEREKLİ)
```

## 🛠️ Sorun Giderme

### "ModuleNotFoundError: No module named 'yfinance'"
```bash
pip install yfinance aiohttp beautifulsoup4
```

### Telegram mesajları gönderilmiyor
1. TELEGRAM_API_KEY doğru mu kontrol et
2. TELEGRAM_CHAT_ID doğru mu kontrol et
3. Bot sohbet grubuna katılmış mı kontrol et

### Sayfalar kontrol edilemiyor
- Sunucu çalışıyor mu (https://bogastock.com'a ping at)
- Firewall internet erişimini engellemiyor mu

## 📞 Destek

Bot dosyası: `site_health_checker.py`
Zamanlayıcı: `hourly_bot.py`
Loglar: `logs/` dizini

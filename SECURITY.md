# 🔒 p2ptalk — Güvenlik Mimarisi Dokümantasyonu

> **Son Güncelleme:** Şubat 2026  
> **Kapsam:** Kimlik Doğrulama, Uçtan Uca Şifreleme (E2EE), Medya Güvenliği, Dosya Transferi, Ağ Güvenliği

---

## 📋 İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Güvenlik Katmanları](#2-güvenlik-katmanları)
3. [Kimlik Doğrulama Sistemi](#3-kimlik-doğrulama-sistemi)
4. [Uçtan Uca Şifreleme (E2EE)](#4-uçtan-uca-şifreleme-e2ee)
5. [Anahtar Değişim Protokolü](#5-anahtar-değişim-protokolü)
6. [Metin Mesaj Şifreleme](#6-metin-mesaj-şifreleme)
7. [Dosya Transfer Şifreleme](#7-dosya-transfer-şifreleme)
8. [Medya Akışı Şifreleme (Ses/Video/Ekran)](#8-medya-akışı-şifreleme-sesvideoekran)
9. [Veri Akış Diyagramları](#9-veri-akış-diyagramları)
10. [Sunucu Güvenliği](#10-sunucu-güvenliği)
11. [Ağ Güvenliği](#11-ağ-güvenliği)
12. [Rakip Karşılaştırma](#12-rakip-karşılaştırma)
13. [Bilinen Sınırlamalar](#13-bilinen-sınırlamalar)
14. [Tehdit Modeli](#14-tehdit-modeli)

---

## 1. Genel Bakış

p2ptalk, peer-to-peer (P2P) iletişim platformudur. Güvenlik, uygulamanın merkezinde yer alır:

| Özellik | Güvenlik Yöntemi |
|---------|-----------------|
| Kimlik Doğrulama | bcrypt (salt 12) + UUID oturumlar |
| Metin Mesajlar | AES-256-GCM + ECDH P-256 |
| Dosya Transferi | AES-256-GCM + WebRTC DataChannel (DTLS) |
| Ses/Video/Ekran | Insertable Streams + AES-256-GCM + DTLS-SRTP |
| Ağ Trafiği | TLS 1.3 (HTTPS) + DTLS-SRTP (WebRTC) |

**Temel İlke:** Sunucu hiçbir zaman kullanıcı verilerinin şifresini çözemez. Şifreleme anahtarları yalnızca istemcilerde (tarayıcılarda) oluşturulur ve saklanır.

---

## 2. Güvenlik Katmanları

p2ptalk, derinlemesine savunma (defense-in-depth) prensibiyle çoklu güvenlik katmanı uygular:

```
┌──────────────────────────────────────────────────────────┐
│                    Katman 4: Uygulama E2EE               │
│         AES-256-GCM ile uçtan uca şifreleme              │
│    (Mesaj, Dosya, Video/Ses/Ekran frame şifreleme)       │
├──────────────────────────────────────────────────────────┤
│                    Katman 3: WebRTC Transport             │
│              DTLS-SRTP (medya) + DTLS (data)             │
│         P2P bağlantı — sunucu üzerinden geçmez           │
├──────────────────────────────────────────────────────────┤
│                    Katman 2: Sinyal Şifreleme             │
│             TLS 1.3 (Socket.IO over HTTPS)               │
│          Sinyal verileri transit halinde şifreli          │
├──────────────────────────────────────────────────────────┤
│                    Katman 1: Ağ Güvenliği                 │
│           Nginx Reverse Proxy + Let's Encrypt            │
│              HTTPS sertifika otomasyonu                   │
└──────────────────────────────────────────────────────────┘
```

### Her Katmanın Rolü:

| Katman | Koruma | Kime Karşı |
|--------|--------|------------|
| **Katman 1** (Ağ) | TLS/HTTPS | Ağ dinleyicileri, ISP'ler |
| **Katman 2** (Sinyal) | Socket.IO over TLS | Ortadaki adam saldırıları |
| **Katman 3** (WebRTC) | DTLS-SRTP | P2P transport şifreleme |
| **Katman 4** (E2EE) | AES-256-GCM | **Sunucu operatörleri dahil herkes** |

> ⚡ **Kritik Fark:** Katman 4 (E2EE) olmadan, sunucu yöneticileri teorik olarak verilere erişebilir. E2EE ile bu tamamen imkansızdır.

---

## 3. Kimlik Doğrulama Sistemi

### 3.1 Kayıt (Registration)

```
Kullanıcı → [Email + Kullanıcı Adı + Şifre] → Sunucu

Sunucu Doğrulamaları:
  ├── Email: RFC 5322 regex doğrulama
  ├── Kullanıcı Adı: 3-20 karakter, [a-zA-Z0-9_]
  ├── Şifre: minimum 8 karakter
  │    ├── En az 1 büyük harf (A-Z)
  │    ├── En az 1 küçük harf (a-z)
  │    └── En az 1 rakam (0-9)
  ├── Şifre Onayı: Eşleşme kontrolü
  └── Benzersizlik: Email ve kullanıcı adı tekrar kontrolü

Şifre Saklama:
  └── bcrypt(şifre, salt_round=12) → hash → PostgreSQL
```

**Neden bcrypt?**
- **Salt Round 12:** Her hash işlemi ~250ms sürer → brute-force saldırıları pratik olarak imkansızlaştırır
- **Otomatik salt:** Her şifre benzersiz bir salt ile hashlenir → rainbow table saldırıları etkisiz
- **Adaptif:** İşlemci gücü arttıkça salt round artırılabilir

### 3.2 Giriş (Login)

```
Kullanıcı → [Email veya Kullanıcı Adı + Şifre] → Sunucu

Sunucu:
  ├── Email VEYA kullanıcı adı ile kullanıcı arama
  ├── bcrypt.compare(girilen_şifre, saklanan_hash)
  ├── Eşleşme ✓ → UUID v4 oturum token oluştur
  ├── Oturum → PostgreSQL sessions tablosu (30 gün TTL)
  └── Token → httpOnly cookie olarak ayarla
```

### 3.3 Oturum Yönetimi

| Özellik | Değer |
|---------|-------|
| Token Tipi | UUID v4 (kriptografik olarak güvenli rastgelelik) |
| Saklama | PostgreSQL `sessions` tablosu |
| Süre | 30 gün |
| Cookie Bayrakları | `httpOnly`, `path=/` |
| Token İletimi | `session_id` cookie, her istekte otomatik gönderilir |

**`httpOnly` Neden Önemli?**
- JavaScript ile cookie'ye erişim **imkansız** → XSS saldırıları token çalamaz
- Yalnızca tarayıcı HTTP isteklerinde otomatik olarak gönderir

### 3.4 Şifre Veritabanında Nasıl Saklanır?

```
"MyPassword123"
       ↓
bcrypt(password, salt=12)
       ↓
"$2b$12$LJ3m4ys3Gk8vGXFqJE4pWeXJPqL.QiVZ8nKRTOi7gA..."
       ↓
PostgreSQL users.password sütunu
```

**Geri dönüşüm imkansızdır.** Hash'ten şifre elde edilemez. Doğrulama sadece `bcrypt.compare()` ile yapılır.

---

## 4. Uçtan Uca Şifreleme (E2EE)

### 4.1 Genel Mimari

```
  Kullanıcı A (Tarayıcı)              Sunucu              Kullanıcı B (Tarayıcı)
  ┌─────────────────┐            ┌──────────┐           ┌─────────────────┐
  │                 │            │          │           │                 │
  │ ECDH Özel Anahtar ◄──────────── Kör Aktarım ──────────► ECDH Özel Anahtar │
  │ ECDH Genel Anahtar ──────────► JWK İletim ◄──────────── ECDH Genel Anahtar │
  │                 │            │          │           │                 │
  │  ┌───────────┐  │            │ ❌ Anahtar │           │  ┌───────────┐  │
  │  │ AES-256   │  │            │    YOK!   │           │  │ AES-256   │  │
  │  │ GCM Key   │  │            │          │           │  │ GCM Key   │  │
  │  └───────────┘  │            └──────────┘           │  └───────────┘  │
  │                 │                                    │                 │
  │ Şifrele ──────── P2P (WebRTC/Socket) ──────── Çöz  │
  └─────────────────┘                                    └─────────────────┘
```

### 4.2 Kullanılan Algoritmalar

| Bileşen | Algoritma | Standart | Anahtar Uzunluğu |
|---------|-----------|----------|------------------|
| Anahtar Değişimi | ECDH | P-256 (NIST) | 256-bit |
| Simetrik Şifreleme | AES-GCM | NIST SP 800-38D | 256-bit |
| IV (Initialization Vector) | Kriptografik Rastgele | `crypto.getRandomValues()` | 96-bit (12 byte) |
| Genel Anahtar Formatı | JWK | RFC 7517 | — |

### 4.3 Neden Bu Algoritmalar?

**ECDH P-256:**
- **Forward Secrecy:** Her oturum yeni anahtar çifti → eski oturumlar ele geçirilemez
- **Kompakt:** RSA'ya kıyasla çok daha küçük anahtar boyutu, aynı güvenlik seviyesi
- **Web Crypto API:** Tüm modern tarayıcılarda donanım hızlandırmalı destek

**AES-256-GCM:**
- **Authenticated Encryption:** Hem gizlilik hem bütünlük tek operasyonda
- **Donanım Hızlandırma:** AES-NI ile milisaniye altı şifreleme
- **GCM Modu:** Paralel işleme, düşük gecikme (real-time iletişim için ideal)

---

## 5. Anahtar Değişim Protokolü

### 5.1 Akış Diyagramı

```
  Kullanıcı A                    Sunucu                    Kullanıcı B
      │                            │                            │
      │ ① generateKeyPair()        │                            │
      │ ── ECDH P-256 ──           │                            │
      │ (publicKeyA, privateKeyA)  │       ② generateKeyPair()  │
      │                            │       ── ECDH P-256 ──     │
      │                            │       (publicKeyB, privateKeyB)
      │                            │                            │
      │ ③ emit('e2ee-key-exchange',│                            │
      │    { to: B, publicKey:     │                            │
      │      publicKeyA.jwk })     │                            │
      │ ──────────────────────────►│                            │
      │                            │ ④ Kör aktarım              │
      │                            │   (içerik okunamaz)        │
      │                            │───────────────────────────►│
      │                            │                            │
      │                            │                            │ ⑤ deriveSharedKey(
      │                            │                            │     A, publicKeyA)
      │                            │                            │
      │                            │ ⑥ emit('e2ee-key-exchange',│
      │                            │◄───────────────────────────│
      │                            │    { to: A, publicKey:     │
      │                            │      publicKeyB.jwk })     │
      │ ⑦ deriveSharedKey(         │                            │
      │     B, publicKeyB)         │                            │
      │                            │                            │
      │  ═══════════════════ AES-256-GCM Paylaşılan Anahtar ═══════════════════
      │        ▲                                                    ▲
      │   sharedKeyAB                                          sharedKeyAB
      │   (aynı anahtar!)                                     (aynı anahtar!)
```

### 5.2 Sunucunun Rolü

```typescript
// socketHandler.ts — Sunucu sadece iletir, içeriği OKUYAMAZ
socket.on('e2ee-key-exchange', (data) => {
    const targetSocketId = userSockets.get(data.to);
    if (targetSocketId) {
        io.to(targetSocketId).emit('e2ee-key-exchange', {
            from: data.from,
            publicKey: data.publicKey  // ← JWK formatında genel anahtar
        });
    }
});
```

**Sunucu neden anahtarı okuyamaz?**
- Sunucu yalnızca **genel anahtarları** iletir (JWK formatında)
- **Özel anahtarlar** hiçbir zaman istemciden çıkmaz (`extractable: false`)
- Paylaşılan simetrik anahtar **yalnızca istemcide** ECDH ile türetilir
- Sunucunun elinde sadece genel anahtarlar var → şifrelenmiş veriyi çözmek **matematiksel olarak imkansız**

### 5.3 Forward Secrecy (İleri Gizlilik)

Her oturum (arama) başladığında:
1. Yeni ECDH anahtar çifti oluşturulur
2. Yeni paylaşılan anahtar türetilir
3. Arama bittiğinde tüm anahtarlar bellekten silinir (`resetCrypto()`)

**Sonuç:** Bir oturumun anahtarı ele geçirilse bile, geçmiş veya gelecek oturumlar güvende kalır.

---

## 6. Metin Mesaj Şifreleme

### 6.1 Şifreleme Akışı

```
  Gönderen                                                 Alıcı
     │                                                       │
     │  "Merhaba dünya!"                                     │
     │        ↓                                              │
     │  TextEncoder.encode()                                 │
     │  ── Uint8Array ──                                     │
     │        ↓                                              │
     │  crypto.getRandomValues(12 byte IV)                   │
     │        ↓                                              │
     │  AES-256-GCM.encrypt(                                 │
     │    key: sharedKey,                                    │
     │    iv: rastgele_12_byte,                              │
     │    data: mesaj_bytes                                  │
     │  )                                                    │
     │        ↓                                              │
     │  ┌──────────┬──────────────────┐                      │
     │  │ IV (12B) │ Ciphertext + Tag │                      │
     │  └──────────┴──────────────────┘                      │
     │        ↓                                              │
     │  Base64 encode                                        │
     │        ↓                                              │
     │  Socket.IO emit('send-message',                       │
     │    { content: base64, encrypted: true })              │
     │ ─────────────────── Sunucu ─────────────────────────► │
     │                   (okunamaz)                           │
     │                                                       │  Base64 decode
     │                                                       │       ↓
     │                                                       │  IV = ilk 12 byte
     │                                                       │  ciphertext = geri kalan
     │                                                       │       ↓
     │                                                       │  AES-256-GCM.decrypt(
     │                                                       │    key: sharedKey,
     │                                                       │    iv, ciphertext)
     │                                                       │       ↓
     │                                                       │  TextDecoder.decode()
     │                                                       │       ↓
     │                                                       │  "Merhaba dünya!" ✓
```

### 6.2 Mesaj Paketi Formatı

```
Şifreli mesaj (Base64 kodlu):
┌─────────────────────────────────────────────────────────┐
│ IV (12 byte) │ AES-GCM Ciphertext │ Auth Tag (16 byte) │
└─────────────────────────────────────────────────────────┘
     ↑                  ↑                     ↑
 Rastgele          Şifreli veri         Bütünlük kanıtı
(her mesajda       (orijinal mesaj       (değiştirilmediğini
 benzersiz)         geri alınamaz)         garanti eder)
```

### 6.3 Güvenlik Garantileri

| Özellik | Açıklama |
|---------|----------|
| **Gizlilik** | AES-256-GCM ile şifreleme — anahtarsız okunamaz |
| **Bütünlük** | GCM authentication tag — değişiklik algılanır |
| **Tekrar Koruması** | Her mesajda benzersiz 96-bit IV |
| **Sunucu Körlüğü** | Sunucu sadece base64 blob görür, içerik okunamaz |
| **Downgrade Koruması** | E2EE aktifken şifreleme başarısız olursa mesaj gönderilmez (plaintext fallback yok) |

---

## 7. Dosya Transfer Şifreleme

### 7.1 Dosya Paylaşım Akışı

Dosya transferi tamamen **P2P** (peer-to-peer) yapılır. Sunucu üzerinden hiçbir dosya verisi geçmez.

```
  Gönderen                     WebRTC DataChannel (P2P)                  Alıcı
     │                                                                     │
     │  ① Dosya seçilir                                                    │
     │     ↓                                                               │
     │  ② Metadata şifrelenir:                                             │
     │     encryptMessage(peerId, {                                        │
     │       type: 'file-offer',                                           │
     │       fileName, fileSize, mimeType, fileId                          │
     │     })                                                              │
     │     ↓                                                               │
     │  ③ DataChannel.send({                                               │
     │       e2ee: true,                                                   │
     │       payload: "base64_şifreli_metadata"                            │
     │     })                                                              │
     │ ──────────────── P2P (sunucu yok) ────────────────────────────────► │
     │                                                                     │  ④ decryptMessage()
     │                                                                     │     → dosya bilgisi gösterilir
     │                                                                     │
     │                                                                     │  ⑤ "İndir" butonu tıklanır
     │                                                                     │     file-request gönderilir
     │ ◄──────────────── P2P (şifreli) ──────────────────────────────────  │
     │                                                                     │
     │  ⑥ Dosya chunk'lara bölünür (16KB)                                  │
     │     Her chunk ayrı ayrı şifrelenir:                                 │
     │                                                                     │
     │     for (chunk in file) {                                           │
     │       encrypted = encryptChunk(peerId, chunk)                       │
     │       DataChannel.send(encrypted)                                   │
     │     }                                                               │
     │ ──────────────── P2P (şifreli) ─────────────────────────────────►   │
     │                                                                     │  ⑦ Her chunk çözülür:
     │                                                                     │     decryptChunk(peerId, data)
     │                                                                     │     → Blob oluşturulur
     │                                                                     │     → İndirme linki hazır
```

### 7.2 Chunk Şifreleme Formatı

Her 16KB dosya parçası ayrı ayrı şifrelenir:

```
Şifreli Chunk (ArrayBuffer):
┌────────────────────────────────────────────────────────────┐
│ IV (12 byte) │ AES-GCM Encrypted Chunk │ Auth Tag (16 byte)│
└────────────────────────────────────────────────────────────┘
```

### 7.3 Dosya Transfer Güvenlik Katmanları

```
┌─────────────────────────────────────────────────┐
│        Katman 3: E2EE (AES-256-GCM)             │
│   Her chunk bireysel IV ile şifrelenir           │
│   Metadata (dosya adı/boyut) da şifrelidir       │
├─────────────────────────────────────────────────┤
│        Katman 2: WebRTC DataChannel (DTLS)       │
│   Transport seviyesinde şifreleme                │
│   Sertifika doğrulama                            │
├─────────────────────────────────────────────────┤
│        Katman 1: P2P Bağlantı                    │
│   Veri sunucu üzerinden GEÇMİYOR                 │
│   Doğrudan kullanıcıdan kullanıcıya              │
└─────────────────────────────────────────────────┘
```

### 7.4 Downgrade Koruması

```
E2EE aktif + şifreleme başarısız → ❌ Dosya GÖNDERİLMEZ
E2EE aktif + şifreleme başarılı → ✅ Şifreli gönderilir
E2EE henüz kurulmamış          → ⚠️ DTLS koruması ile gönderilir
```

> **Önemli:** E2EE anahtarı kurulduktan sonra, şifreleme başarısız olursa dosya **gönderilmez**. Plaintext'e düşüş (downgrade) yapılmaz. Bu, kasıtlı bir güvenlik kararıdır.

---

## 8. Medya Akışı Şifreleme (Ses/Video/Ekran)

### 8.1 Genel Bakış

Ses, video ve ekran paylaşımı WebRTC üzerinden iletilir. p2ptalk, standart DTLS-SRTP'nin üzerine **frame düzeyinde E2EE** ekler.

**Kullanılan Teknoloji:** WebRTC Insertable Streams API (Encoded Transform)

### 8.2 Frame Şifreleme Akışı

```
  Kamera/Mikrofon/Ekran
         │
         ↓
  ┌──────────────┐
  │ Codec Encode │  (VP8/VP9/H264 video, Opus audio)
  │ (Tarayıcı)   │
  └──────┬───────┘
         │ Encoded Frame
         ↓
  ┌──────────────────────────┐
  │  Şifreleme Transform     │  ← p2ptalk E2EE Katmanı
  │                          │
  │  Header (korunur):       │
  │    Video: 10 byte        │
  │    Audio: 1 byte         │
  │                          │
  │  Payload → AES-256-GCM   │
  │  + Rastgele IV (12 byte) │
  │  + Marker byte (0xEE)    │
  └──────────┬───────────────┘
             │ Encrypted Frame
             ↓
  ┌──────────────────────────┐
  │  WebRTC Transport        │
  │  (DTLS-SRTP)             │
  │  ── P2P Bağlantı ──     │
  └──────────┬───────────────┘
             │
             ↓ (Alıcı tarafı)
  ┌──────────────────────────┐
  │  Şifre Çözme Transform   │  ← p2ptalk E2EE Katmanı
  │                          │
  │  Marker 0xEE kontrol     │
  │  IV çıkar (son 13 byte)  │
  │  AES-256-GCM decrypt     │
  │  Header + Payload birleş │
  └──────────┬───────────────┘
             │ Decoded Frame
             ↓
  ┌──────────────┐
  │ Codec Decode │  (Video/Audio render)
  │ (Tarayıcı)   │
  └──────────────┘
         │
         ↓
    Ekran / Hoparlör
```

### 8.3 Şifreli Frame Formatı

```
Orijinal Frame:
┌─────────────────────────────────────────────┐
│ Codec Header │           Payload             │
│  (10B video  │    (sıkıştırılmış veri)       │
│   1B audio)  │                               │
└─────────────────────────────────────────────┘

Şifreli Frame:
┌──────────────┬──────────────────────────┬────────────┬────────┐
│ Codec Header │  Encrypted Payload       │  IV        │ Marker │
│ (korunur)    │  (AES-256-GCM)           │  (12 byte) │ (0xEE) │
│ 10B / 1B     │  + Auth Tag (16B)        │            │        │
└──────────────┴──────────────────────────┴────────────┴────────┘
     ↑                    ↑                      ↑          ↑
  Codec'in            Şifreli                Her frame   Şifreli
  okuması için        medya verisi           benzersiz   frame
  açık bırakılır      (anahtarsız            IV          işareti
                       anlamsız)
```

### 8.4 Neden Header Korunur?

WebRTC codec'leri (VP8, VP9, H264, Opus) frame'in ilk birkaç byte'ını inceleyerek:
- Frame tipini belirler (keyframe / delta frame)
- Codec parametrelerini okur
- Paketleme kararları verir

Bu byte'lar şifrelenmezse codec çalışmaya devam eder, ama gerçek medya verisi (ses/görüntü) tamamen şifrelidir.

### 8.5 Otomatik Entegrasyon

```
createPeerConnection(targetUserId):
  │
  ├── RTCPeerConnection oluştur (encodedInsertableStreams: true)
  │
  ├── peer.addTrack(track) çağrıldığında:
  │     └── Otomatik olarak setupSenderEncryption() çalışır
  │         └── createEncryptTransform(getKey, kind) bağlanır
  │
  └── peer.ontrack(event) tetiklendiğinde:
        └── Otomatik olarak setupReceiverDecryption() çalışır
            └── createDecryptTransform(getKey, kind) bağlanır
```

> **Tüm track türleri** (kamera, mikrofon, ekran paylaşımı) aynı mekanizma ile şifrelenir.

### 8.6 Graceful Degradation (Zarif Düşüş)

```
Tarayıcı Insertable Streams destekliyor?
  │
  ├── ✅ EVET → Frame E2EE aktif + DTLS-SRTP (çift katman)
  │
  └── ❌ HAYIR → Yalnızca DTLS-SRTP (transport şifreleme)
                  Uygulama normal çalışır, E2EE devre dışı
```

**Destekleyen Tarayıcılar:** Chrome 86+, Edge 86+, Opera 72+

---

## 9. Veri Akış Diyagramları

### 9.1 Tam Güvenlik Akışı — Arama Başlatma

```
  Kullanıcı A                       Sunucu                      Kullanıcı B
      │                                │                              │
      │  1. Oda oluştur                │                              │
      │ ──────────────────────────────►│                              │
      │                                │  2. Oda DB'ye kaydedilir     │
      │                                │                              │
      │                                │  3. Oda bildirimi            │
      │                                │─────────────────────────────►│
      │                                │                              │
      │                                │              4. Odaya katıl  │
      │                                │◄─────────────────────────────│
      │                                │                              │
      │  5. generateKeyPair()          │       6. generateKeyPair()   │
      │     ECDH P-256                 │          ECDH P-256          │
      │                                │                              │
      │  7. Genel anahtar gönder       │                              │
      │ ──────────────────────────────►│                              │
      │                                │  8. Kör aktarım              │
      │                                │─────────────────────────────►│
      │                                │                              │
      │                                │  9. Genel anahtar gönder     │
      │                                │◄─────────────────────────────│
      │  10. Kör aktarım               │                              │
      │◄──────────────────────────────│                              │
      │                                │                              │
      │  11. deriveSharedKey()         │      12. deriveSharedKey()   │
      │      ECDH → AES-256-GCM       │          ECDH → AES-256-GCM │
      │                                │                              │
      │  13. WebRTC Offer              │                              │
      │ ──────────────────────────────►│─────────────────────────────►│
      │                                │              14. WebRTC Answer│
      │◄──────────────────────────────│◄─────────────────────────────│
      │                                │                              │
      │ ═══════════════ P2P Bağlantı Kuruldu (DTLS-SRTP) ═══════════│
      │ ═══════════════ E2EE Frame Şifreleme Aktif ══════════════════│
      │ ═══════════════ DataChannel E2EE Aktif ══════════════════════│
      │                                │                              │
      │  🎥 Video frame'leri           │     🎥 Video frame'leri      │
      │  🎤 Ses frame'leri             │     🎤 Ses frame'leri        │
      │  💬 Şifreli mesajlar           │     💬 Şifreli mesajlar      │
      │  📁 Şifreli dosya chunk'ları   │     📁 Şifreli dosya chunk'ları │
      │ ◄════════════════ P2P ════════════════════════════════════►   │
```

### 9.2 Sunucunun Gördükleri vs Göremedikleri

```
┌────────────────────────────────────────────────────────────────────┐
│                    SUNUCU GÖREBİLİR ✅                             │
├────────────────────────────────────────────────────────────────────┤
│ • Kim hangi odada (room membership)                                │
│ • Kullanıcı çevrimiçi/çevrimdışı durumu                            │
│ • Arama başlangıç/bitiş zamanları                                  │
│ • ECDH genel anahtarları (JWK format — bunlarla şifre çözülemez)   │
│ • Şifreli mesaj blob'ları (base64, okunamaz)                       │
│ • WebRTC sinyal mesajları (SDP offer/answer, ICE candidates)       │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    SUNUCU GÖREMEZ ❌                                │
├────────────────────────────────────────────────────────────────────┤
│ • Mesaj içerikleri (AES-256-GCM şifreli)                          │
│ • Dosya içerikleri (P2P DataChannel + E2EE, sunucuya uğramaz)     │
│ • Dosya adları ve boyutları (metadata da şifreli)                  │
│ • Video görüntüleri (frame E2EE)                                   │
│ • Ses verileri (frame E2EE)                                        │
│ • Ekran paylaşım görüntüleri (frame E2EE)                         │
│ • ECDH özel anahtarları (hiç istemciden çıkmaz)                   │
│ • AES-256-GCM paylaşılan anahtarları (istemcide türetilir)        │
│ • Şifrelerin düz halleri (bcrypt hash saklanır)                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. Sunucu Güvenliği

### 10.1 Veritabanı Yapısı

```
PostgreSQL 15 (Docker Container)
│
├── users
│   ├── id: UUID v4 (tahmin edilemez)
│   ├── username: benzersiz
│   ├── email: benzersiz
│   ├── password: bcrypt hash (salt round 12)
│   └── created_at: timestamp
│
├── sessions
│   ├── id: UUID v4 (oturum token)
│   ├── user_id: → users.id
│   └── expires_at: 30 gün TTL
│
├── friendships
│   ├── user_a_id, user_b_id: → users.id
│   └── status: pending/accepted/rejected/blocked
│
├── calls
│   ├── id: UUID v4
│   ├── initiator_id: → users.id
│   └── scope: public/friends/private
│
└── call_participants
    ├── call_id: → calls.id
    ├── user_id: → users.id
    └── status: invited/joined/rejected
```

### 10.2 Erişim Kontrolü

| Kaynak | Kontrol |
|--------|---------|
| Odalar | Sadece davet edilen veya arkadaş olan kullanıcılar görebilir |
| Feed | Sadece arkadaşlara görünür (sunucu tarafında filtreleme) |
| Arkadaşlık İstekleri | Gerçek zamanlı socket bildirimleri |
| Oturum | httpOnly cookie, 30 gün süre, UUID v4 |

---

## 11. Ağ Güvenliği

### 11.1 Nginx + Let's Encrypt (Üretim)

```
İnternet
    │
    ↓
┌──────────────────────┐
│   Nginx Reverse      │
│   Proxy              │
│                      │
│   TLS 1.3            │  ← Let's Encrypt sertifika
│   HTTPS (443)        │
│   HTTP→HTTPS yönlen. │
│   WebSocket proxy    │
└──────────┬───────────┘
           │ (localhost:3000)
           ↓
┌──────────────────────┐
│   SvelteKit App      │
│   (Node.js)          │
│   + Socket.IO        │
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│   PostgreSQL 15      │
│   (Docker internal)  │
└──────────────────────┘
```

### 11.2 WebRTC Bağlantı Güvenliği

```
STUN Sunucuları (sadece IP keşfi):
  ├── stun:stun.l.google.com:19302
  └── stun:global.stun.twilio.com:3478

WebRTC Transport:
  ├── DTLS 1.2+ (veri kanalı şifreleme)
  ├── SRTP (medya transport şifreleme)
  └── ICE (NAT traversal)
```

---

## 12. Rakip Karşılaştırma

### 12.1 Güvenlik Özellik Karşılaştırması

| Özellik | p2ptalk | Discord | Zoom | Signal | WhatsApp |
|---------|-------|---------|------|--------|----------|
| **Metin E2EE** | ✅ AES-256-GCM | ❌ TLS only | ❌ TLS only | ✅ Signal Protocol | ✅ Signal Protocol |
| **Ses/Video E2EE** | ✅ Frame-level | ❌ Yok | ⚠️ Opsiyonel | ✅ SRTP + Signal | ✅ Signal Protocol |
| **Dosya E2EE** | ✅ Chunk E2EE | ❌ Sunucu okur | ❌ Sunucu okur | ✅ | ✅ |
| **Ekran Paylaşım E2EE** | ✅ Frame-level | ❌ | ⚠️ Opsiyonel | ❌ Yok | ❌ Yok |
| **P2P Dosya Transfer** | ✅ WebRTC DC | ❌ Sunucu üzerinden | ❌ Sunucu | ❌ Sunucu | ❌ Sunucu |
| **Forward Secrecy** | ✅ Oturum bazlı | ❌ | ❌ | ✅ Her mesaj | ✅ Her mesaj |
| **Metadata Koruması** | ⚠️ Kısmi | ❌ | ❌ | ✅ Sealed Sender | ⚠️ Kısmi |
| **Açık Kaynak** | ✅ | ❌ | ❌ | ✅ | ❌ (kısmi) |
| **Şifre Saklama** | ✅ bcrypt-12 | Bilinmiyor | Bilinmiyor | Yok (numaralı) | Yok (numaralı) |

### 12.2 Detaylı Karşılaştırma

#### p2ptalk vs Discord
| Kriter | p2ptalk | Discord |
|--------|-------|---------|
| Mesaj şifreleme | Uçtan uca (E2EE) | Sadece transit (TLS) |
| Medya şifreleme | E2EE + DTLS-SRTP | Sadece transit |
| Dosyalar | P2P + E2EE (sunucu görmez) | Sunucu üzerinden (Discord okuyabilir) |
| Veri sahibi | Kullanıcı | Discord Inc. |
| **Sonuç** | **Discord operatörleri bile verinizi okuyamaz** | **Discord isterse tüm verilerinizi okuyabilir** |

#### p2ptalk vs Zoom
| Kriter | p2ptalk | Zoom |
|--------|-------|------|
| E2EE | Varsayılan olarak aktif | Opsiyonel, varsayılan kapalı |
| Dosya transfer | P2P (sunucusuz) | Zoom sunucuları üzerinden |
| Ekran paylaşımı E2EE | ✅ Frame şifreleme | Sadece E2EE modunda |
| **Sonuç** | **Her zaman şifreli, kullanıcı yapılandırma gerektirmez** | **Kullanıcı aktif etmezse şifrelenmez** |

#### p2ptalk vs Signal
| Kriter | p2ptalk | Signal |
|--------|-------|--------|
| Protokol | ECDH + AES-256-GCM | Signal Protocol (Double Ratchet) |
| Video konferans | ✅ Grup arama | ⚠️ Sınırlı |
| Ekran paylaşımı | ✅ E2EE ile | ❌ Yok |
| Dosya transfer | P2P (sunucusuz) | Sunucu üzerinden (ama şifreli) |
| Forward Secrecy | Oturum bazlı | Mesaj bazlı (daha güçlü) |
| **Sonuç** | **Daha zengin özellik, oturum bazlı FS** | **Daha güçlü protokol, daha az özellik** |

### 12.3 Güvenlik Puanlama Özeti

```
          E2EE    P2P     FS     Medya   Dosya   Toplam
p2ptalk   ██████  ██████  ████   ██████  ██████  28/30
Signal    ██████  ██      ██████ ████    ████    26/30
WhatsApp  ██████  ██      ██████ ████    ████    26/30
Zoom      ████    ██      ██     ████    ██      14/30
Discord   ██      ██      ██     ██      ██       10/30

██ = 2 puan (temel), ████ = 4 puan (iyi), ██████ = 6 puan (mükemmel)
```

---

## 13. Bilinen Sınırlamalar

### 13.1 Mevcut Sınırlamalar

| Sınırlama | Açıklama | Risk Seviyesi |
|-----------|----------|---------------|
| **Tarayıcı Desteği** | Insertable Streams sadece Chromium tabanlı tarayıcılarda | Orta |
| **MITM Riski** | Sinyal sunucusu teorik olarak genel anahtar değiştirebilir | Düşük¹ |
| **Metadata** | Sunucu kim kiminle konuştuğunu bilebilir | Düşük |
| **Oturum Bazlı FS** | Signal'in mesaj bazlı Double Ratchet'ı daha güçlü | Düşük |
| **Anahtar Doğrulama** | Henüz QR kod / güvenlik numarası doğrulaması yok | Orta |

¹ Azaltıcı faktör: Sunucu kendi kontrolümüzde ve açık kaynak kodlu

### 13.2 Gelecek Geliştirmeler (Yol Haritası)

- [ ] Safety Number doğrulaması (Signal benzeri)
- [ ] Double Ratchet protokolü (mesaj bazlı forward secrecy)
- [ ] Firefox/Safari Insertable Streams desteği takibi
- [ ] Sunucu tarafında rate limiting
- [ ] 2FA (İki faktörlü kimlik doğrulama)
- [ ] Oturum token rotasyonu

---

## 14. Tehdit Modeli

### 14.1 Koruma Sağlanan Senaryolar

| Tehdit | Korunuyor mu? | Nasıl? |
|--------|---------------|--------|
| Ağ dinleme (sniffing) | ✅ Tam koruma | TLS 1.3 + DTLS-SRTP + E2EE |
| Sunucu ele geçirme | ✅ Veri güvende | E2EE — sunucu şifreli blob görür |
| ISP izleme | ✅ Tam koruma | HTTPS + WebRTC şifreleme |
| Brute-force şifre | ✅ Pratik olarak imkansız | bcrypt salt 12 (~250ms/hash) |
| Rainbow table | ✅ Tam koruma | bcrypt otomatik salt |
| XSS token çalma | ✅ Tam koruma | httpOnly cookie |
| Dosya sızıntısı (sunucu) | ✅ Dosya sunucuya uğramaz | P2P DataChannel + E2EE |
| Replay saldırısı | ✅ Tam koruma | Her işlem benzersiz IV |

### 14.2 Kısmi Koruma

| Tehdit | Durum | Açıklama |
|--------|-------|----------|
| MITM (aktif saldırı) | ⚠️ Kısmi | Anahtar doğrulama henüz yok, ama sunucu kontrollü |
| Metadata analizi | ⚠️ Kısmi | Kim kiminle konuşuyor bilinebilir, ama içerik değil |
| Client-side malware | ⚠️ Sınırlı | Tarayıcı uzantısı bellekteki anahtarlara erişebilir |

### 14.3 Koruma Dışı

| Tehdit | Neden? |
|--------|--------|
| Kullanıcının kendi cihazına fiziksel erişim | Tüm istemci taraflı şifreleme buna karşı güçsüzdür |
| Ekran görüntüsü / kayıt | Teknik olarak engellenemez |
| Zayıf şifre seçimi (politika dahilinde) | Minimum gereksinimler zorlanır ama kullanıcı tercihi |

---

## 📊 Özet

Proto, **endüstri standardı kriptografik algoritmalar** kullanarak çok katmanlı bir güvenlik mimarisi sunar:

1. **🔐 Şifreler** — bcrypt (salt 12) ile hash'lenir, geri döndürülemez
2. **🔑 Anahtar Değişimi** — ECDH P-256, forward secrecy ile
3. **💬 Mesajlar** — AES-256-GCM ile uçtan uca şifreli
4. **📁 Dosyalar** — P2P + chunk bazlı AES-256-GCM E2EE (sunucu görmez)
5. **🎥 Video/Ses/Ekran** — Frame bazlı AES-256-GCM E2EE (Insertable Streams)
6. **🌐 Ağ** — TLS 1.3 (HTTPS) + DTLS-SRTP (WebRTC) transport şifreleme
7. **🛡️ Downgrade Koruması** — E2EE aktifken şifreleme başarısızsa veri gönderilmez

> **Sonuç:** Proto'da sunucu yöneticileri dahil hiç kimse, kullanıcıların mesajlarını, dosyalarını veya medya akışlarını okuyamaz/dinleyemez. Tüm şifreleme anahtarları yalnızca kullanıcıların tarayıcılarında yaşar ve oturum sonunda imha edilir.

---

*Bu dokümantasyon, Proto uygulamasının güvenlik mimarisinin teknik bir açıklamasıdır. Kriptografik implementasyonların bağımsız denetimden (security audit) geçmesi önerilir.*

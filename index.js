// Gerekli modüllerin import edilmesi
const express = require('express'); // Web uygulama çatısı
const cors = require('cors'); // Cross-Origin Resource Sharing (Farklı kaynaklardan gelen isteklere izin verme)
const bodyParser = require('body-parser'); // İstek (request) body'lerini parse etmek için
const xlsx = require('xlsx'); // Excel dosyalarını okumak ve yazmak için
const path = require('path'); // Dosya ve dizin yollarıyla çalışmak için
const fs = require('fs'); // Dosya sistemi işlemleri için (okuma, yazma vb.)
const multer = require('multer'); // Dosya yüklemelerini yönetmek için

// Express uygulamasının oluşturulması
const app = express();
// API'nin çalışacağı port numarası
const PORT = 5000;

// JSON dosyalarının yolları (Verilerin saklandığı yerler)
const DUYURULAR_PATH = path.join(__dirname, 'duyurular.json'); // Duyurular verisinin yolu
const INDIRIMLER_PATH = path.join(__dirname, 'indirimler.json'); // İndirimler verisinin yolu
const ANKETLER_PATH = path.join(__dirname, 'anketler.json'); // Anketler verisinin yolu
const SAATLER_PATH = path.join(__dirname, 'saatler.json'); // Çalışma saatleri verisinin yolu

// Multer (dosya yükleme) ayarları
const storage = multer.diskStorage({
  // Yüklenen dosyaların kaydedileceği dizini belirler
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads'); // 'uploads' adında bir klasör oluşturulur veya kullanılır
    if (!fs.existsSync(uploadDir)) { // Eğer 'uploads' klasörü yoksa
      fs.mkdirSync(uploadDir); // Klasörü oluştur
    }
    cb(null, uploadDir); // Hata yoksa, dosyayı bu dizine kaydet
  },
  // Yüklenen dosyanın adını belirler
  filename: function (req, file, cb) {
    // Dosya adının benzersiz olması için tarih ve rastgele bir sayı eklenir
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Hata yoksa, yeni dosya adını kullan
  }
});

// Multer'ın yükleme yapılandırması
const upload = multer({
  storage: storage, // Yukarıda tanımlanan depolama ayarlarını kullan
  // Dosya filtresi: Sadece belirli türdeki dosyaların yüklenmesine izin verir
  fileFilter: function (req, file, cb) {
    // Sadece jpg, jpeg, png, gif uzantılı dosyaları kabul et
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      // Hata durumunda, sadece resim dosyalarının yüklenebileceğini belirten bir mesaj gönder
      return cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
    cb(null, true); // Hata yoksa, dosyayı kabul et
  },
  // Dosya boyutu limiti ayarları
  limits: {
    fileSize: 5 * 1024 * 1024 // Maksimum 5MB dosya boyutuna izin ver
  }
});

// Middleware'lerin (ara yazılımların) kullanılması
app.use(cors()); // CORS'u etkinleştirerek farklı kaynaklardan gelen isteklere izin ver
app.use(bodyParser.json()); // Gelen JSON verilerini parse et

// Ana endpoint: API'nin çalıştığını kontrol etmek için
// İstek: GET /
// Yanıt: "Kırıkkale Üniversitesi Seç Market API Çalışıyor!" mesajı
app.get('/', (req, res) => {
  res.send('Kırıkkale Üniversitesi Seç Market API Çalışıyor!');
});

// Puanları getiren endpoint
// İstek: GET /api/puanlar
// Yanıt: puanlar.json dosyasındaki işlenmiş ve sıralanmış puan verileri
app.get('/api/puanlar', (req, res) => {
  try {
    // puanlar.json dosyasını oku
    const puanlarHam = require('./puanlar.json');
    // Sadece geçerli puan satırlarını al (başlıkları ve geçersiz satırları atla)
    let puanlar = puanlarHam
      .filter(item => /^\d+$/.test(item["21 nisan 06 mayıs harcama ve puan"])) // ID'si sadece sayı olanları filtrele
      .map(item => {
        // Puanı sayıya çevir ve formatla
        let puanStr = (item["__EMPTY"] || "").toString(); // Puan string'ini al
        // Puan string'ini sayıya dönüştürmek için temizle (örn: "1.116,50 ₺" -> "1116.50")
        let puanNum = parseFloat(
          puanStr
            .replace(/\s/g, '')      // boşlukları sil
            .replace('₺', '')        // ₺ işaretini sil
            .replace(/\./g, '')      // binlik ayırıcı noktaları sil
            .replace(',', '.')       // ondalık virgülünü noktaya çevir
        );
        // Eğer dönüştürme başarısız olursa puanı 0 yap
        if (isNaN(puanNum)) puanNum = 0;
        return {
          id: item["21 nisan 06 mayıs harcama ve puan"], // Kullanıcı ID'si
          puan: puanStr, // Orijinal puan metni
          puanNum // Sayısal puan değeri
        };
      });

    // Puanları büyükten küçüğe doğru sırala
    puanlar = puanlar.sort((a, b) => b.puanNum - a.puanNum);

    // Sadece ID ve orijinal puan metnini geri döndür
    res.json(puanlar.map(({id, puan}) => ({id, puan})));
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'puanlar.json okunamadı', details: err.message });
  }
});

// Duyuruları getiren endpoint
// İstek: GET /api/duyurular
// Yanıt: duyurular.json dosyasındaki tüm duyurular
app.get('/api/duyurular', (req, res) => {
  try {
    // Eğer duyurular.json dosyası yoksa, boş bir JSON array dosyası oluştur
    if (!fs.existsSync(DUYURULAR_PATH)) {
      fs.writeFileSync(DUYURULAR_PATH, '[]');
    }
    // Duyurular dosyasını oku ve JSON olarak parse et
    const data = fs.readFileSync(DUYURULAR_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Duyurular okunamadı', details: err.message });
  }
});

// Yeni duyuru ekleyen endpoint
// İstek: POST /api/duyurular
// Request Body: { baslik: string, icerik: string, resim?: string }
// Yanıt: Eklenen yeni duyuru nesnesi
app.post('/api/duyurular', (req, res) => {
  try {
    const { baslik, icerik, resim } = req.body; // İstek body'sinden başlık, içerik ve resmi al
    // Başlık ve içerik zorunlu alanlar, kontrol et
    if (!baslik || !icerik) {
      return res.status(400).json({ error: 'Başlık ve içerik zorunlu.' }); // Eksik bilgi varsa 400 (Bad Request) hatası döndür
    }
    let duyurular = [];
    // Eğer duyurular.json dosyası varsa, içeriğini oku ve parse et
    if (fs.existsSync(DUYURULAR_PATH)) {
      duyurular = JSON.parse(fs.readFileSync(DUYURULAR_PATH, 'utf-8'));
    }
    // Yeni duyuru nesnesini oluştur
    const yeniDuyuru = {
      id: Date.now(), // Benzersiz bir ID ata (şimdiki zamanın milisaniye cinsinden değeri)
      baslik,
      icerik,
      resim: resim || null, // Resim varsa kullan, yoksa null ata
      tarih: new Date().toISOString() // Duyurunun oluşturulma tarihini ISO formatında kaydet
    };
    duyurular.unshift(yeniDuyuru); // Yeni duyuruyu listenin başına ekle
    // Güncellenmiş duyurular listesini dosyaya yaz
    fs.writeFileSync(DUYURULAR_PATH, JSON.stringify(duyurular, null, 2)); // null, 2 ile daha okunaklı JSON formatı
    res.json(yeniDuyuru); // Eklenen duyuruyu yanıt olarak gönder
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Duyuru eklenemedi', details: err.message });
  }
});

// İndirimli ürünleri getiren endpoint
// İstek: GET /api/indirimler
// Yanıt: indirimler.json dosyasındaki tüm indirimli ürünler
app.get('/api/indirimler', (req, res) => {
  try {
    // Eğer indirimler.json dosyası yoksa, boş bir JSON array dosyası oluştur
    if (!fs.existsSync(INDIRIMLER_PATH)) {
      fs.writeFileSync(INDIRIMLER_PATH, '[]');
    }
    // İndirimler dosyasını oku ve JSON olarak parse et
    const data = fs.readFileSync(INDIRIMLER_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'İndirimli ürünler okunamadı', details: err.message });
  }
});

// Yeni indirimli ürün ekleyen endpoint
// İstek: POST /api/indirimler
// Request Body: { isim: string, aciklama?: string, fiyat: string, resim?: string }
// Yanıt: Eklenen yeni indirimli ürün nesnesi
app.post('/api/indirimler', (req, res) => {
  try {
    const { isim, aciklama, fiyat, resim } = req.body; // İstek body'sinden ürün bilgilerini al
    // İsim ve fiyat zorunlu alanlar, kontrol et
    if (!isim || !fiyat) {
      return res.status(400).json({ error: 'İsim ve fiyat zorunlu.' }); // Eksik bilgi varsa 400 (Bad Request) hatası döndür
    }
    let indirimler = [];
    // Eğer indirimler.json dosyası varsa, içeriğini oku ve parse et
    if (fs.existsSync(INDIRIMLER_PATH)) {
      indirimler = JSON.parse(fs.readFileSync(INDIRIMLER_PATH, 'utf-8'));
    }
    // Yeni indirimli ürün nesnesini oluştur
    const yeniUrun = {
      id: Date.now(), // Benzersiz bir ID ata
      isim,
      aciklama: aciklama || '', // Açıklama varsa kullan, yoksa boş string ata
      fiyat,
      resim: resim || null, // Resim varsa kullan, yoksa null ata
      tarih: new Date().toISOString() // Eklenme tarihini kaydet
    };
    indirimler.unshift(yeniUrun); // Yeni ürünü listenin başına ekle
    // Güncellenmiş indirimler listesini dosyaya yaz
    fs.writeFileSync(INDIRIMLER_PATH, JSON.stringify(indirimler, null, 2));
    res.json(yeniUrun); // Eklenen ürünü yanıt olarak gönder
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'İndirimli ürün eklenemedi', details: err.message });
  }
});

// Anketleri getiren endpoint
// İstek: GET /api/anketler
// Yanıt: anketler.json dosyasındaki tüm anketler
app.get('/api/anketler', (req, res) => {
  try {
    // Eğer anketler.json dosyası yoksa, boş bir JSON array dosyası oluştur
    if (!fs.existsSync(ANKETLER_PATH)) {
      fs.writeFileSync(ANKETLER_PATH, '[]');
    }
    // Anketler dosyasını oku ve JSON olarak parse et
    const data = fs.readFileSync(ANKETLER_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Anketler okunamadı', details: err.message });
  }
});

// Yeni anket ekleyen endpoint
// İstek: POST /api/anketler
// Request Body: { soru: string, secenekler: string[] } (secenekler en az 2 elemanlı bir dizi olmalı)
// Yanıt: Eklenen yeni anket nesnesi
app.post('/api/anketler', (req, res) => {
  try {
    const { soru, secenekler } = req.body; // İstek body'sinden soru ve seçenekleri al
    // Soru ve seçeneklerin geçerliliğini kontrol et
    if (!soru || !Array.isArray(secenekler) || secenekler.length < 2) {
      return res.status(400).json({ error: 'Soru ve en az 2 seçenek zorunlu.' }); // Geçersiz veri varsa 400 (Bad Request) hatası
    }
    let anketler = [];
    // Eğer anketler.json dosyası varsa, içeriğini oku ve parse et
    if (fs.existsSync(ANKETLER_PATH)) {
      anketler = JSON.parse(fs.readFileSync(ANKETLER_PATH, 'utf-8'));
    }
    // Yeni anket nesnesini oluştur
    const yeniAnket = {
      id: Date.now(), // Benzersiz bir ID ata
      soru,
      secenekler: secenekler.map(s => ({ text: s, oy: 0 })), // Her seçeneği bir nesneye dönüştür (text ve başlangıç oyu 0)
      tarih: new Date().toISOString() // Eklenme tarihini kaydet
    };
    anketler.unshift(yeniAnket); // Yeni anketi listenin başına ekle
    // Güncellenmiş anketler listesini dosyaya yaz
    fs.writeFileSync(ANKETLER_PATH, JSON.stringify(anketler, null, 2));
    res.json(yeniAnket); // Eklenen anketi yanıt olarak gönder
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Anket eklenemedi', details: err.message });
  }
});

// Ankete oy veren endpoint
// İstek: POST /api/anket-oy
// Request Body: { anketId: number, secenekIndex: number }
// Yanıt: { success: true, anket: guncellenmisAnket } veya hata mesajı
app.post('/api/anket-oy', (req, res) => {
  try {
    const { anketId, secenekIndex } = req.body; // İstek body'sinden anket ID'si ve seçenek index'ini al
    // Gelen verilerin türünü kontrol et
    if (typeof anketId !== 'number' || typeof secenekIndex !== 'number') {
      return res.status(400).json({ error: 'Geçersiz veri.' }); // Geçersiz veri türü varsa 400 (Bad Request) hatası
    }
    let anketler = [];
    // Eğer anketler.json dosyası varsa, içeriğini oku ve parse et
    if (fs.existsSync(ANKETLER_PATH)) {
      anketler = JSON.parse(fs.readFileSync(ANKETLER_PATH, 'utf-8'));
    }
    // İlgili anketi ID'sine göre bul
    const anket = anketler.find(a => a.id === anketId);
    if (!anket) return res.status(404).json({ error: 'Anket bulunamadı.' }); // Anket bulunamazsa 404 (Not Found) hatası
    // Seçeneğin geçerliliğini kontrol et
    if (!anket.secenekler[secenekIndex]) return res.status(400).json({ error: 'Seçenek bulunamadı.' }); // Geçersiz seçenek index'i ise 400 (Bad Request)
    anket.secenekler[secenekIndex].oy += 1; // Seçeneğin oy sayısını bir artır
    // Güncellenmiş anketler listesini dosyaya yaz
    fs.writeFileSync(ANKETLER_PATH, JSON.stringify(anketler, null, 2));
    res.json({ success: true, anket }); // Başarılı yanıt ve güncellenmiş anketi gönder
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Oy eklenemedi', details: err.message });
  }
});

// Çalışma saatlerini getiren endpoint
// İstek: GET /api/saatler
// Yanıt: saatler.json dosyasındaki çalışma saatleri verisi
app.get('/api/saatler', (req, res) => {
  try {
    // Eğer saatler.json dosyası yoksa, varsayılan saatleri içeren bir dosya oluştur
    if (!fs.existsSync(SAATLER_PATH)) {
      const defaultSaatler = {
        haftalik: { // Haftalık çalışma saatleri
          Pazartesi: { acilis: '09:00', kapanis: '21:00' },
          Salı: { acilis: '09:00', kapanis: '21:00' },
          Çarşamba: { acilis: '09:00', kapanis: '21:00' },
          Perşembe: { acilis: '09:00', kapanis: '21:00' },
          Cuma: { acilis: '09:00', kapanis: '21:00' },
          Cumartesi: { acilis: '10:00', kapanis: '20:00' },
          Pazar: { acilis: null, kapanis: null } // Pazar kapalı
        },
        ozelGunler: [] // Özel günler için (örn: bayramlar) ayrı saatler eklenebilir
      };
      fs.writeFileSync(SAATLER_PATH, JSON.stringify(defaultSaatler, null, 2));
    }
    // Saatler dosyasını oku ve JSON olarak parse et
    const data = fs.readFileSync(SAATLER_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Saatler okunamadı', details: err.message });
  }
});

// Çalışma saatlerini güncelleyen endpoint
// İstek: POST /api/saatler
// Request Body: { haftalik: object, ozelGunler?: array }
// Yanıt: Güncellenmiş saatler nesnesi
app.post('/api/saatler', (req, res) => {
  try {
    const { haftalik, ozelGunler } = req.body; // İstek body'sinden haftalık ve özel gün saatlerini al
    // Haftalık saatlerin zorunlu olduğunu kontrol et
    if (!haftalik) return res.status(400).json({ error: 'Haftalık saatler zorunlu.' }); // Eksik bilgi varsa 400 (Bad Request)
    // Yeni saatler nesnesini oluştur
    const yeniSaatler = { haftalik, ozelGunler: ozelGunler || [] }; // Özel günler yoksa boş dizi ata
    // Güncellenmiş saatleri dosyaya yaz
    fs.writeFileSync(SAATLER_PATH, JSON.stringify(yeniSaatler, null, 2));
    res.json(yeniSaatler); // Güncellenmiş saatleri yanıt olarak gönder
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Saatler güncellenemedi', details: err.message });
  }
});

// Duyuru silme endpoint'i
// İstek: DELETE /api/duyurular/:id (id: silinecek duyurunun ID'si)
// Yanıt: { success: true } veya hata mesajı
app.delete('/api/duyurular/:id', (req, res) => {
  const id = parseInt(req.params.id); // URL'den duyuru ID'sini al ve sayıya çevir
  const duyurular = JSON.parse(fs.readFileSync(DUYURULAR_PATH)); // Duyuruları oku
  const yeniDuyurular = duyurular.filter(d => d.id !== id); // ID'si eşleşmeyenleri filtreleyerek sil
  fs.writeFileSync(DUYURULAR_PATH, JSON.stringify(yeniDuyurular, null, 2)); // Güncel listeyi dosyaya yaz
  res.json({ success: true }); // Başarılı yanıt gönder
});

// İndirimli ürün silme endpoint'i
// İstek: DELETE /api/indirimler/:id (id: silinecek ürünün ID'si)
// Yanıt: { success: true } veya hata mesajı
app.delete('/api/indirimler/:id', (req, res) => {
  const id = parseInt(req.params.id); // URL'den ürün ID'sini al
  const indirimler = JSON.parse(fs.readFileSync(INDIRIMLER_PATH)); // İndirimleri oku
  const yeniIndirimler = indirimler.filter(i => i.id !== id); // ID'si eşleşmeyenleri filtrele
  fs.writeFileSync(INDIRIMLER_PATH, JSON.stringify(yeniIndirimler, null, 2)); // Güncel listeyi dosyaya yaz
  res.json({ success: true }); // Başarılı yanıt gönder
});

// Anket silme endpoint'i
// İstek: DELETE /api/anketler/:id (id: silinecek anketin ID'si)
// Yanıt: { success: true } veya hata mesajı
app.delete('/api/anketler/:id', (req, res) => {
  const id = parseInt(req.params.id); // URL'den anket ID'sini al
  const anketler = JSON.parse(fs.readFileSync(ANKETLER_PATH)); // Anketleri oku
  const yeniAnketler = anketler.filter(a => a.id !== id); // ID'si eşleşmeyenleri filtrele
  fs.writeFileSync(ANKETLER_PATH, JSON.stringify(yeniAnketler, null, 2)); // Güncel listeyi dosyaya yaz
  res.json({ success: true }); // Başarılı yanıt gönder
});

// Resim yükleme endpoint'i
// İstek: POST /api/upload (Form-data içerisinde 'image' adında bir dosya beklenir)
// Yanıt: { url: '/uploads/dosyaadi.uzanti' } veya hata mesajı
app.post('/api/upload', upload.single('image'), (req, res) => { // 'image' adlı tek bir dosya yüklemesini işle
  try {
    // Eğer dosya yüklenmemişse hata döndür
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }
    // Yüklenen dosyanın sunucudaki URL'ini oluştur
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl }); // Başarılı yanıt ve resim URL'ini gönder
  } catch (err) {
    // Hata durumunda 500 (Sunucu Hatası) kodu ve hata mesajını döndür
    res.status(500).json({ error: 'Resim yüklenirken hata oluştu', details: err.message });
  }
});

// 'uploads' klasörünü statik olarak sunarak resimlere erişimi sağla
// Örneğin, http://localhost:5000/uploads/dosyaadi.jpg şeklinde erişilebilir
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sunucuyu belirtilen portta dinlemeye başla
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor.`); // Sunucu başladığında konsola mesaj yazdır
});

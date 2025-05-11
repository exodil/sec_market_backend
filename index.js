const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = 5000;

const DUYURULAR_PATH = path.join(__dirname, 'duyurular.json');
const INDIRIMLER_PATH = path.join(__dirname, 'indirimler.json');
const ANKETLER_PATH = path.join(__dirname, 'anketler.json');
const SAATLER_PATH = path.join(__dirname, 'saatler.json');

// Multer ayarları
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Kırıkkale Üniversitesi Seç Market API Çalışıyor!');
});

app.get('/api/puanlar', (req, res) => {
  try {
    const puanlarHam = require('./puanlar.json');
    // Sadece gerçek puan satırlarını al, başlıkları atla
    let puanlar = puanlarHam
      .filter(item => /^\d+$/.test(item["21 nisan 06 mayıs harcama ve puan"]))
      .map(item => ({
        id: item["21 nisan 06 mayıs harcama ve puan"],
        puan: item["__EMPTY"]
      }));

    // Puanları sayıya çevirip büyükten küçüğe sırala
    puanlar = puanlar.sort((a, b) => {
      // "1.116,50 ₺" -> 1116.50
      const numA = parseFloat(a.puan.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
      const numB = parseFloat(b.puan.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
      return numB - numA;
    });

    res.json(puanlar);
  } catch (err) {
    res.status(500).json({ error: 'puanlar.json okunamadı', details: err.message });
  }
});

// Duyuruları oku
app.get('/api/duyurular', (req, res) => {
  try {
    if (!fs.existsSync(DUYURULAR_PATH)) {
      fs.writeFileSync(DUYURULAR_PATH, '[]');
    }
    const data = fs.readFileSync(DUYURULAR_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Duyurular okunamadı', details: err.message });
  }
});

// Yeni duyuru ekle
app.post('/api/duyurular', (req, res) => {
  try {
    const { baslik, icerik, resim } = req.body;
    if (!baslik || !icerik) {
      return res.status(400).json({ error: 'Başlık ve içerik zorunlu.' });
    }
    let duyurular = [];
    if (fs.existsSync(DUYURULAR_PATH)) {
      duyurular = JSON.parse(fs.readFileSync(DUYURULAR_PATH, 'utf-8'));
    }
    const yeniDuyuru = {
      id: Date.now(),
      baslik,
      icerik,
      resim: resim || null,
      tarih: new Date().toISOString()
    };
    duyurular.unshift(yeniDuyuru);
    fs.writeFileSync(DUYURULAR_PATH, JSON.stringify(duyurular, null, 2));
    res.json(yeniDuyuru);
  } catch (err) {
    res.status(500).json({ error: 'Duyuru eklenemedi', details: err.message });
  }
});

// İndirimli ürünleri oku
app.get('/api/indirimler', (req, res) => {
  try {
    if (!fs.existsSync(INDIRIMLER_PATH)) {
      fs.writeFileSync(INDIRIMLER_PATH, '[]');
    }
    const data = fs.readFileSync(INDIRIMLER_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'İndirimli ürünler okunamadı', details: err.message });
  }
});

// Yeni indirimli ürün ekle
app.post('/api/indirimler', (req, res) => {
  try {
    const { isim, aciklama, fiyat, resim } = req.body;
    if (!isim || !fiyat) {
      return res.status(400).json({ error: 'İsim ve fiyat zorunlu.' });
    }
    let indirimler = [];
    if (fs.existsSync(INDIRIMLER_PATH)) {
      indirimler = JSON.parse(fs.readFileSync(INDIRIMLER_PATH, 'utf-8'));
    }
    const yeniUrun = {
      id: Date.now(),
      isim,
      aciklama: aciklama || '',
      fiyat,
      resim: resim || null,
      tarih: new Date().toISOString()
    };
    indirimler.unshift(yeniUrun);
    fs.writeFileSync(INDIRIMLER_PATH, JSON.stringify(indirimler, null, 2));
    res.json(yeniUrun);
  } catch (err) {
    res.status(500).json({ error: 'İndirimli ürün eklenemedi', details: err.message });
  }
});
// Anketleri oku
app.get('/api/anketler', (req, res) => {
  try {
    if (!fs.existsSync(ANKETLER_PATH)) {
      fs.writeFileSync(ANKETLER_PATH, '[]');
    }
    const data = fs.readFileSync(ANKETLER_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Anketler okunamadı', details: err.message });
  }
});

// Yeni anket ekle
app.post('/api/anketler', (req, res) => {
  try {
    const { soru, secenekler } = req.body;
    if (!soru || !Array.isArray(secenekler) || secenekler.length < 2) {
      return res.status(400).json({ error: 'Soru ve en az 2 seçenek zorunlu.' });
    }
    let anketler = [];
    if (fs.existsSync(ANKETLER_PATH)) {
      anketler = JSON.parse(fs.readFileSync(ANKETLER_PATH, 'utf-8'));
    }
    const yeniAnket = {
      id: Date.now(),
      soru,
      secenekler: secenekler.map(s => ({ text: s, oy: 0 })),
      tarih: new Date().toISOString()
    };
    anketler.unshift(yeniAnket);
    fs.writeFileSync(ANKETLER_PATH, JSON.stringify(anketler, null, 2));
    res.json(yeniAnket);
  } catch (err) {
    res.status(500).json({ error: 'Anket eklenemedi', details: err.message });
  }
});

// Anket oyu ver
app.post('/api/anket-oy', (req, res) => {
  try {
    const { anketId, secenekIndex } = req.body;
    if (typeof anketId !== 'number' || typeof secenekIndex !== 'number') {
      return res.status(400).json({ error: 'Geçersiz veri.' });
    }
    let anketler = [];
    if (fs.existsSync(ANKETLER_PATH)) {
      anketler = JSON.parse(fs.readFileSync(ANKETLER_PATH, 'utf-8'));
    }
    const anket = anketler.find(a => a.id === anketId);
    if (!anket) return res.status(404).json({ error: 'Anket bulunamadı.' });
    if (!anket.secenekler[secenekIndex]) return res.status(400).json({ error: 'Seçenek bulunamadı.' });
    anket.secenekler[secenekIndex].oy += 1;
    fs.writeFileSync(ANKETLER_PATH, JSON.stringify(anketler, null, 2));
    res.json({ success: true, anket });
  } catch (err) {
    res.status(500).json({ error: 'Oy eklenemedi', details: err.message });
  }
});

// Saatleri oku
app.get('/api/saatler', (req, res) => {
  try {
    if (!fs.existsSync(SAATLER_PATH)) {
      // Varsayılan saatler: Pazartesi-Cuma 09:00-21:00, Cumartesi 10:00-20:00, Pazar kapalı
      const defaultSaatler = {
        haftalik: {
          Pazartesi: { acilis: '09:00', kapanis: '21:00' },
          Salı: { acilis: '09:00', kapanis: '21:00' },
          Çarşamba: { acilis: '09:00', kapanis: '21:00' },
          Perşembe: { acilis: '09:00', kapanis: '21:00' },
          Cuma: { acilis: '09:00', kapanis: '21:00' },
          Cumartesi: { acilis: '10:00', kapanis: '20:00' },
          Pazar: { acilis: null, kapanis: null }
        },
        ozelGunler: []
      };
      fs.writeFileSync(SAATLER_PATH, JSON.stringify(defaultSaatler, null, 2));
    }
    const data = fs.readFileSync(SAATLER_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Saatler okunamadı', details: err.message });
  }
});

// Saatleri güncelle
app.post('/api/saatler', (req, res) => {
  try {
    const { haftalik, ozelGunler } = req.body;
    if (!haftalik) return res.status(400).json({ error: 'Haftalık saatler zorunlu.' });
    const yeniSaatler = { haftalik, ozelGunler: ozelGunler || [] };
    fs.writeFileSync(SAATLER_PATH, JSON.stringify(yeniSaatler, null, 2));
    res.json(yeniSaatler);
  } catch (err) {
    res.status(500).json({ error: 'Saatler güncellenemedi', details: err.message });
  }
});

// Duyuru silme endpoint'i
app.delete('/api/duyurular/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const duyurular = JSON.parse(fs.readFileSync(DUYURULAR_PATH));
  const yeniDuyurular = duyurular.filter(d => d.id !== id);
  fs.writeFileSync(DUYURULAR_PATH, JSON.stringify(yeniDuyurular, null, 2));
  res.json({ success: true });
});

// İndirimli ürün silme endpoint'i
app.delete('/api/indirimler/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const indirimler = JSON.parse(fs.readFileSync(INDIRIMLER_PATH));
  const yeniIndirimler = indirimler.filter(i => i.id !== id);
  fs.writeFileSync(INDIRIMLER_PATH, JSON.stringify(yeniIndirimler, null, 2));
  res.json({ success: true });
});

// Anket silme endpoint'i
app.delete('/api/anketler/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const anketler = JSON.parse(fs.readFileSync(ANKETLER_PATH));
  const yeniAnketler = anketler.filter(a => a.id !== id);
  fs.writeFileSync(ANKETLER_PATH, JSON.stringify(yeniAnketler, null, 2));
  res.json({ success: true });
});

// Resim yükleme endpoint'i
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Resim yüklenirken hata oluştu', details: err.message });
  }
});

// Uploads klasörünü statik olarak sun
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor.`);
});

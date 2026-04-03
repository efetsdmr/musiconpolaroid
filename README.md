# Foto Satış Takip Uygulaması

Basit bir web uygulaması:

- Günlük satılan fotoğraf adedini kaydeder
- Birim fiyat üzerinden toplam ciroyu hesaplar
- Kayıtları listeler, günceller ve siler
- Bugün, bu ay ve genel toplam özetlerini gösterir

## Kurulum

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Tarayıcıda `http://127.0.0.1:8000` adresini açın.

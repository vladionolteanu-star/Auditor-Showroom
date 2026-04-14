# PLAN: Antrenare YOLOv11 Custom — Obiecte Specifice Showroom

> **Status:** DRAFT — Așteaptă aprobare utilizator
> **Creat:** 2026-04-14
> **Agent:** project-planner + security-auditor

---

## Obiectiv

Antrenarea unui model YOLOv11 custom care detectează obiecte specifice zonelor de casierie și birou consilier din showroom-ul firmei, înlocuind modelul generic COCO (80 de clase) cu unul specializat.

---

## Clasele Custom Propuse (v1)

| # | Clasă | Zonă | Descriere |
|---|-------|------|-----------|
| 1 | `receipt` | Casierie | Bonuri fiscale / chitanțe pe birou |
| 2 | `badge` | Ambele | Ecuson/badge angajat vizibil pe piept |
| 3 | `flyer` | Ambele | Materiale publicitare, cataloage, flyere firmă |
| 4 | `personal_phone` | Ambele | Telefon personal pe birou (nu cel de serviciu) |
| 5 | `headphones` | Ambele | Căști personale vizibile |
| 6 | `cup_bottle` | Ambele | Cană cafea / sticlă apă pe birou |
| 7 | `folder_organized` | Consilier | Dosare stivuite ordonat |
| 8 | `folder_messy` | Consilier | Hârtii/dosare în dezordine |
| 9 | `monitor` | Ambele | Monitor/ecran de serviciu |
| 10 | `keyboard_mouse` | Ambele | Tastatură + mouse (referință birou) |
| 11 | `person` | Ambele | Persoană (preluată din modele pre-antrenat COCO) |
| 12 | `chair` | Ambele | Scaun (referință spațiu) |

> [!IMPORTANT]
> **User Review:** Confirmă această listă! Adaugă sau elimină clase înainte de a începe colectarea de date. Fiecare clasă adăugată ulterior necesită re-antrenare completă.

---

## Fazele Proiectului

### Faza 0: Pregătire Mediu (1 zi)

| Task | Detalii |
|------|---------|
| Cont Roboflow | Creare cont gratuit pe [roboflow.com](https://roboflow.com) — tool de annotare vizuală gratuit (până la 10.000 imagini) |
| Cont Google Colab | Verificare acces la GPU gratuit (T4) pe [colab.research.google.com](https://colab.research.google.com) |
| Structură dataset | Creare folder `dataset/` în proiect cu subfoldere `images/` și `labels/` |

### Faza 1: Colectare Date (3-5 zile)

**Strategie:** Folosim camera aplicației existente pentru a captura imagini direct din showroom.

| Task | Detalii |
|------|---------|
| Script captură | Adăugăm un buton "📸 Captură Training" în UI care salvează frame-ul curent ca JPEG pe backend |
| Endpoint API | `POST /api/v1/capture` — primește imaginea base64, o salvează în `dataset/raw/` cu timestamp |
| Obiectiv | **Minimum 150 imagini per clasă** (ideal 300+) |
| Variație | Imagini din unghiuri diferite, iluminări diferite (dimineață/seară), cu/fără obiecte |
| Imagini negative | 50-100 imagini fără niciun obiect target (birouri goale, coridoare) |

**Reguli fotografiere:**
- Camera la distanța normală de lucru (1-2 metri)
- Include și scene "bune" (conforme) și scene "rele" (neconforme)
- Variază fundalul, unghiul, lumina
- Minime 3 magazine/locații diferite dacă posibil

### Faza 2: Annotare Date (3-5 zile)

| Task | Detalii |
|------|---------|
| Upload Roboflow | Încarcă toate imaginile brute pe Roboflow |
| Annotare vizuală | Desenează bounding box-uri pe fiecare obiect din fiecare imagine |
| Quality Check | Verificare 10% din annotări de o persoană diferită |
| Export | Export format YOLOv11 (`*.txt` cu coordonate normalizate) |
| Split date | Train 70% / Validation 20% / Test 10% (automat de Roboflow) |

**Structura finală dataset:**
```
dataset/
├── data.yaml          # Config cu clase și căi
├── train/
│   ├── images/        # ~70% din poze
│   └── labels/        # Fișiere .txt cu bounding boxes
├── valid/
│   ├── images/        # ~20%
│   └── labels/
└── test/
    ├── images/        # ~10%
    └── labels/
```

**Fișierul `data.yaml`:**
```yaml
train: ./train/images
val: ./valid/images
test: ./test/images
nc: 12
names:
  - receipt
  - badge
  - flyer
  - personal_phone
  - headphones
  - cup_bottle
  - folder_organized
  - folder_messy
  - monitor
  - keyboard_mouse
  - person
  - chair
```

### Faza 3: Antrenare Model (1 zi — pe Google Colab)

Deoarece calculatorul tău nu are GPU NVIDIA, vom folosi **Google Colab gratuit (GPU T4)**.

| Task | Detalii |
|------|---------|
| Notebook Colab | Creem un notebook `.ipynb` cu pipeline-ul complet |
| Upload dataset | Zip-uim dataset-ul și îl încărcăm pe Google Drive |
| Fine-tune | YOLOv11n pre-antrenat pe COCO, fine-tuned pe datele noastre |
| Epoci | 100 de epoci (cu early stopping la 20 epoci fără îmbunătățire) |
| Export | `.pt` (pentru backend Python) + `.onnx` (pentru frontend browser) |

**Comanda de antrenare (în Colab):**
```python
from ultralytics import YOLO

# Pornim de la modelul pre-antrenat (transfer learning)
model = YOLO('yolo11n.pt')

# Fine-tune pe datele noastre custom
results = model.train(
    data='/content/dataset/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    patience=20,        # early stopping
    name='showroom-v1',
    pretrained=True,
)

# Export pentru backend
model.export(format='onnx')  # → showroom-v1.onnx
```

**Timp estimat:** ~30-60 minute pe T4 gratuit cu ~2000 imagini.

### Faza 4: Integrare în Aplicație (1 zi)

| Task | Detalii |
|------|---------|
| Backend | Înlocuim `yolo11n.pt` cu `showroom-v1.pt` în `yolo_service.py` |
| Frontend | Înlocuim `yolo11n.onnx` cu `showroom-v1.onnx` în `public/` |
| Clase | Actualizăm array-ul `COCO_CLASSES` din `useYoloDetection.ts` cu cele 12 clase noi |
| Culori | Mapăm culori semantice noi (roșu = neconform, verde = conform) |
| Prompt Gemini | Actualizăm promptul ca Gemini să cunoască noile clase |

### Faza 5: Testare & Iterare (2-3 zile)

| Task | Detalii |
|------|---------|
| Test câmp | Testăm în minim 2 locații reale (casierie + birou) |
| Metrics | Evaluăm mAP50, mAP50-95, recall per clasă |
| False positives | Identificăm ce detectează greșit |
| Re-antrenare | Dacă e nevoie, adăugăm mai multe imagini pentru clasele slabe |
| Objective | mAP50 ≥ 0.70 pe fiecare clasă |

---

## Dependențe & Cerințe

| Resursă | Necesar | Disponibil |
|---------|---------|------------|
| GPU antrenare | NVIDIA T4+ | Google Colab (gratuit) |
| Imagini brute | 1500-3000 total | De colectat |
| Tool annotare | Roboflow | Gratuit (< 10K imagini) |
| Spațiu stocare | ~2-5 GB dataset | Google Drive |
| Timp total | ~10-15 zile | — |

---

## Riscuri și Mitigare

| Risc | Impact | Mitigare |
|------|--------|----------|
| Date insuficiente per clasă | Model slab pe acele clase | Augmentare automată (rotire, blur, contrast) în Roboflow |
| Variație mică iluminare | Nu funcționează seara | Capturăm în mai multe condiții de lumină |
| Google Colab timeout | Antrenare întreruptă | Salvare checkpoint la fiecare 10 epoci pe Drive |
| Model prea mare pt browser | FPS scăzut pe frontend | Folosim `yolo11n` (nano) — cel mai mic |
| Clasele `folder_organized` vs `folder_messy` sunt ambigue | Confuzie model | Posibil să le combinăm într-o singură clasă `folder` și lăsăm Gemini să decidă starea |

> [!WARNING]
> **Clasele subiective** (`folder_organized` vs `folder_messy`) sunt cel mai greu de antrenat pentru un model de computer vision. Recomandarea mea: folosim o singură clasă `folder` pentru YOLO și delegăm judecata de "ordonat/dezordonat" către Gemini care înțelege contextul.

---

## Timeline Estimat

```
Săptămâna 1: Faza 0 + Faza 1 (pregătire + colectare poze)
Săptămâna 2: Faza 2 (annotare pe Roboflow)
Săptămâna 3: Faza 3 + 4 + 5 (antrenare + integrare + test)
```

---

## Acțiuni Imediate (Astăzi)

1. **Revert frontend la MediaPipe** — Până la antrenarea modelului custom, revenim la tracking fluid (30 FPS)
2. **Adăugare buton "Captură Training"** — Script simplu care salvează frame-uri pentru dataset
3. **Creare cont Roboflow** — (acțiune manuală a utilizatorului)
4. **Creare cont Google Colab** — (acțiune manuală a utilizatorului)

---

## Verificare Finală (Definition of Done)

- [ ] Dataset cu ≥150 imagini per clasă, annotate corect
- [ ] Model antrenat cu mAP50 ≥ 0.70 per clasă
- [ ] Export `.pt` funcțional pe backend
- [ ] Export `.onnx` funcțional pe frontend
- [ ] Promptul Gemini actualizat cu clasele custom
- [ ] Test în minim 2 locații reale de showroom
- [ ] FPS ≥ 10 pe frontend cu modelul custom

# ΔΑΠΑΧΟ Equipment Management System

Ολοκληρωμένο σύστημα καταγραφής, παρακολούθησης και διαχείρισης εξοπλισμού της ΔΑΠΑΧΟ.

Η εφαρμογή υποστηρίζει ατομικά καταγεγραμμένο εξοπλισμό (Assets), αναλώσιμα και αποθέματα (Stock), τοποθεσίες, χρεώσεις, συντηρήσεις, Service, φωτογραφίες, τεχνικά έγγραφα, QR Codes, χρήστες, δικαιώματα και Audit Log.

---

## Βασικές δυνατότητες

### Equipment Models

Κεντρική διαχείριση:

- Κατηγοριών εξοπλισμού
- Κατασκευαστών
- Μοντέλων
- Κωδικών προϊόντων
- Περιγραφών και σημειώσεων
- Τεχνικών εγγράφων / manuals

Η δομή είναι:

`Κατηγορία → Μοντέλο → Asset / Stock`

---

## Assets

Κάθε Asset αποτελεί συγκεκριμένο φυσικό αντικείμενο και διαθέτει:

- Μοναδικό UUID
- Μόνιμο κωδικό απογραφής
- Κατηγορία
- Κατασκευαστή / μοντέλο
- Serial Number
- Τεχνική κατάσταση
- Lifecycle status
- Σημειώσεις
- Φωτογραφίες
- QR Code
- Ιστορικό τοποθετήσεων
- Ιστορικό συντήρησης
- Ιστορικό Service

Παράδειγμα κωδικού:

`AF-001`

Οι κωδικοί δημιουργούνται αυτόματα από το σύστημα και δεν επαναχρησιμοποιούνται.

### Technical Status

Υποστηρίζονται:

- `FUNCTIONAL`
- `HAS_ISSUE`
- `UNDER_REPAIR`
- `OUT_OF_SERVICE`

### Lifecycle

- `ACTIVE`
- `RETIRED`

Η απόσυρση ενός Asset δεν διαγράφει το ιστορικό του.

---

## QR Codes

Κάθε Asset διαθέτει μόνιμο QR token.

Το QR οδηγεί σε public URL της μορφής:

`/q/:token`

Η δημόσια σελίδα μπορεί να εμφανίζει μόνο ασφαλή δεδομένα όπως:

- Κωδικό Asset
- Κατηγορία
- Κατασκευαστή
- Μοντέλο
- Lifecycle status
- Δημόσιες φωτογραφίες
- Δημόσια manuals

Εσωτερικά ή ευαίσθητα δεδομένα δεν εκτίθενται δημόσια.

Υποστηρίζεται επίσης εκτύπωση φυσικής ετικέτας QR για τον εξοπλισμό.

---

## Asset Photos

Κάθε Asset μπορεί να διαθέτει έως 5 φωτογραφίες.

Υποστηρίζονται:

- JPEG
- PNG
- WEBP

Μέγιστο μέγεθος αρχείου: 5 MB.

Οι φωτογραφίες αποθηκεύονται σε private Supabase Storage bucket και παρέχονται μέσω signed URLs.

---

## Stock Management

Το Stock χρησιμοποιείται για αντικείμενα που παρακολουθούνται ποσοτικά και όχι ως ξεχωριστές φυσικές μονάδες.

Υποστηρίζονται κινήσεις:

- `RECEIPT` — Παραλαβή
- `TRANSFER` — Μεταφορά
- `WRITE_OFF` — Απόσυρση
- `ADJUSTMENT` — Διόρθωση

Το διαθέσιμο υπόλοιπο υπολογίζεται από το ιστορικό κινήσεων και δεν αποθηκεύεται ως χειροκίνητα επεξεργάσιμο counter.

Υποστηρίζεται υπόλοιπο:

- ανά τοποθεσία
- συνολικά

Το backend αποτρέπει κινήσεις που θα δημιουργούσαν αρνητικό απόθεμα.

---

## Locations & Assignments

Υποστηρίζονται τοποθεσίες:

- `STORAGE`
- `VEHICLE`
- `FACILITY`
- `OTHER`

Ένα Asset μπορεί να έχει μόνο μία ενεργή τοποθέτηση κάθε στιγμή.

Το σύστημα διατηρεί πλήρες ιστορικό:

`Asset → Location → Started At → Ended At`

Η αλλαγή τοποθεσίας κλείνει την προηγούμενη ανάθεση και δημιουργεί νέα.

Η αφαίρεση Asset από τοποθεσία διατηρεί επίσης το ιστορικό.

---

## Maintenance

Το σύστημα υποστηρίζει καταγραφή εργασιών συντήρησης.

Κάθε maintenance event μπορεί να περιλαμβάνει:

- Ημερομηνία
- Τύπο εργασίας
- Περιγραφή
- Προηγούμενη τεχνική κατάσταση
- Νέα τεχνική κατάσταση
- Σημειώσεις
- Χρήστη που πραγματοποίησε την καταχώριση

Η τεχνική κατάσταση του Asset ενημερώνεται μέσω της διαδικασίας συντήρησης.

---

## Service Management

Υποστηρίζεται ολοκληρωμένο workflow αποστολής εξοπλισμού για Service.

### Αποστολή

Καταγράφονται:

- Asset
- Περιγραφή βλάβης
- Εταιρεία / τεχνικός Service
- Ημερομηνία παράδοσης
- Παραδίδων από ΔΑΠΑΧΟ
- Ιδιότητα παραδίδοντος
- Παραλαμβάνων στο Service
- Ιδιότητα παραλαμβάνοντος

Δημιουργείται αυτόματα μοναδικός αριθμός:

`SRV-YYYY-NNNN`

Παράδειγμα:

`SRV-2026-0001`

Κατά την αποστολή το Asset μεταβαίνει σε:

`UNDER_REPAIR`

### Επιστροφή

Καταγράφονται:

- Ημερομηνία επιστροφής
- Εργασίες που πραγματοποιήθηκαν
- Κόστος
- Τελική τεχνική κατάσταση
- Σημειώσεις
- Παραδίδων από Service
- Ιδιότητα
- Παραλαμβάνων από ΔΑΠΑΧΟ
- Ιδιότητα

Το Service Case κλείνει ως:

`RETURNED`

Υποστηρίζεται επίσης ακύρωση Service Case.

---

## Service PDFs

Η εφαρμογή δημιουργεί δύο επίσημα PDF:

### Δελτίο Παράδοσης Εξοπλισμού για Service

Δημιουργείται κατά την αποστολή του εξοπλισμού.

### Δελτίο Παραλαβής Εξοπλισμού από Service

Δημιουργείται μετά την επιστροφή.

Τα PDF είναι:

- A4
- Ελληνικά
- Μονοσέλιδα
- Συνδεδεμένα με το Service Case
- Αποθηκευμένα στο Supabase Storage

Για την παραγωγή PDF χρησιμοποιείται ξεχωριστό Node.js service με Chromium / Playwright.

Τα δεδομένα ταυτότητας του Asset αποθηκεύονται επίσης ως snapshots στο Service Case, ώστε τα ιστορικά έγγραφα να μην αλλάζουν εάν μεταβληθούν αργότερα τα στοιχεία του Asset.

---

## Service Documents

Κάθε Service Case μπορεί να περιλαμβάνει έγγραφα όπως:

- Δελτίο Παράδοσης
- Δελτίο Παραλαβής
- Service Report
- Repair Report
- Προσφορά
- Τιμολόγιο
- Άλλα PDF

Υποστηρίζονται generated και external documents.

Τα αρχεία αποθηκεύονται σε private Supabase Storage.

---

## Model Documents

Τα Equipment Models μπορούν να διαθέτουν:

- User Manual
- Quick Start Guide
- Technical Manual
- Other documents

Ορισμένα έγγραφα μπορούν να χαρακτηριστούν public ώστε να εμφανίζονται και στη δημόσια QR σελίδα.

---

## Users & Roles

Η εφαρμογή διαθέτει τρεις ρόλους:

### VIEWER

Πρόσβαση ανάγνωσης στα επιτρεπόμενα δεδομένα.

### OPERATOR

Επιχειρησιακές ενέργειες όπως:

- Assignments
- Maintenance
- Service
- Stock movements
- Επιτρεπόμενες ενημερώσεις Assets

### ADMIN

Πλήρης διοικητική πρόσβαση, όπως:

- Διαχείριση χρηστών
- Ρόλοι
- Categories
- Manufacturers
- Equipment Models
- Administrative actions
- Audit Log

Η δημιουργία χρηστών πραγματοποιείται μέσω προστατευμένου Supabase Edge Function.

---

## Audit Log

Οι κρίσιμες ενέργειες καταγράφονται στο `audit_log`.

Ενδεικτικά:

- Asset updates
- Asset retirement / reactivation
- Location changes
- Unassignments
- Maintenance
- Stock movements
- Service creation
- Service return
- Service cancellation
- User creation
- User role changes
- User activation / deactivation
- Equipment model changes

Το Audit Log καταγράφει όπου απαιτείται:

- Χρήστη
- Ενέργεια
- Entity
- Κωδικό
- Περιγραφή
- Previous data
- New data
- Timestamp

---

## Τεχνολογίες

### Frontend

- React
- TypeScript
- Vite
- React Router

### Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security
- PostgreSQL RPC Functions
- Database Triggers
- Supabase Storage
- Supabase Edge Functions

### PDF Service

- Node.js
- Express
- Playwright
- Chromium
- Supabase JS

---

## Αρχιτεκτονική

```text
Browser
   │
   ▼
React / Vite
   │
   ├──────────────► Supabase Auth
   │
   ├──────────────► PostgreSQL / RPC
   │
   ├──────────────► Supabase Storage
   │
   ├──────────────► Supabase Edge Functions
   │
   └──────────────► PDF Service
                         │
                         ▼
                 Playwright / Chromium
                         │
                         ▼
                    PDF Generation
                         │
                         ▼
                 Supabase Storage
```

---

## Project Structure

```text
dapaxo-equipment/
│
├── src/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── pages/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
│
├── supabase/
│   └── functions/
│       ├── create-user/
│       ├── public-asset-photos/
│       ├── public-model-documents/
│       └── ...
│
├── pdf-service/
│   ├── templates/
│   │   ├── service-handover.html
│   │   └── service-return.html
│   ├── server.js
│   └── package.json
│
├── .env.local
├── package.json
├── tsconfig.app.json
├── vite.config.ts
└── README.md
```

---

## Environment Variables

### Frontend

Δημιουργήστε `.env.local`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_PUBLIC_APP_URL=http://localhost:5173
VITE_PDF_SERVICE_URL=http://localhost:3100
```

Δεν πρέπει να τοποθετείται ποτέ `SUPABASE_SERVICE_ROLE_KEY` στο frontend.

### PDF Service

Στο:

`pdf-service/.env`

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3100
```

Το Service Role Key είναι backend secret και δεν πρέπει να γίνει commit ή να σταλεί στον browser.

---

## Local Development

### Frontend

Από τη ρίζα του project:

```bash
npm install
npm run dev
```

Η εφαρμογή είναι διαθέσιμη συνήθως στο:

`http://localhost:5173`

### PDF Service

Σε δεύτερο terminal:

```bash
cd pdf-service
npm install
node server.js
```

Health endpoint:

`http://localhost:3100/health`

---

## Supabase Edge Functions

Παράδειγμα deployment:

```bash
npx supabase functions deploy create-user
```

Για public Edge Functions που έχουν σχεδιαστεί να λειτουργούν χωρίς JWT verification, χρησιμοποιείται η αντίστοιχη Supabase deployment configuration.

Η πρόσβαση σε δεδομένα εξακολουθεί να πρέπει να ελέγχεται από τον κώδικα της function.

---

## Security

Η εφαρμογή χρησιμοποιεί πολλαπλά επίπεδα προστασίας:

- Supabase Authentication
- PostgreSQL Row Level Security
- Role checks
- SECURITY DEFINER RPC functions
- Restricted direct table mutations
- Private Storage buckets
- Signed URLs
- Random QR tokens
- Server-side Service Role Key
- Audit logging

Το frontend δεν θεωρείται security boundary.

Οι πραγματικοί περιορισμοί εφαρμόζονται στο backend.

---

## Important Security Rules

Δεν πρέπει να γίνονται commit:

```text
.env
.env.local
.env.*
Supabase Service Role Keys
Database passwords
API secrets
```

Ενδεικτικό `.gitignore`:

```gitignore
node_modules/
dist/

.env
.env.*
!.env.example

pdf-service/.env
```

---

## Data Principles

Το σύστημα ακολουθεί ορισμένες βασικές αρχές:

**Permanent identity**

Το UUID και ο κωδικός Asset αποτελούν μόνιμη ταυτότητα.

**No code reuse**

Οι κωδικοί απογραφής δεν επαναχρησιμοποιούνται.

**History over deletion**

Ιστορικά δεδομένα δεν χάνονται επειδή ένα Asset αποσύρθηκε ή μετακινήθηκε.

**Derived state**

Όπου είναι δυνατόν, η τρέχουσα κατάσταση προκύπτει από τα πραγματικά δεδομένα και όχι από ανεξάρτητα boolean flags.

**Least privilege**

Οι χρήστες λαμβάνουν μόνο τα δικαιώματα που απαιτεί ο ρόλος τους.

**Public QR isolation**

Η δημόσια QR σελίδα εκθέτει μόνο ρητά επιτρεπόμενα δεδομένα.

---

## Current Version

### v1

Η πρώτη έκδοση περιλαμβάνει:

- Equipment Categories
- Manufacturers
- Equipment Models
- Assets
- Stock
- Locations
- Assignments
- Asset Photos
- QR identification
- Public QR pages
- Model documents
- Maintenance
- Service cases
- Service documents
- Service handover PDF
- Service return PDF
- User management
- Roles & permissions
- Audit Log

---

## Before Production Release

Πριν την παραγωγική λειτουργία απαιτείται:

- Τελικό end-to-end QA
- Production deployment frontend
- Deployment του Chromium PDF Service
- Production CORS configuration
- Production environment variables
- Supabase migration verification
- Backup
- Έλεγχος VIEWER / OPERATOR / ADMIN
- Καθαρισμός test data
- Έλεγχος responsive UI
- Αφαίρεση παλιών/μη χρησιμοποιούμενων PDF functions

---

## Future Improvements

Πιθανές επεκτάσεις μετά τη v1:

- Dedicated `IN_SERVICE` workflow
- Advanced stock concurrency locking
- Automated maintenance events from Service
- Notifications / reminders
- Scheduled inspections
- Warranty tracking
- Procurement information
- Advanced reports
- CSV / Excel reporting
- Dashboard analytics
- Additional QR workflows

---

## Organization

**ΔΑΠΑΧΟ**

Σύστημα διαχείρισης και απογραφής επιχειρησιακού, τηλεπικοινωνιακού και πληροφοριακού εξοπλισμού.
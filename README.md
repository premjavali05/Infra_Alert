<div align="center">

# Infra-Alert

### Report civic issues. Track progress. Build better communities.

A civic grievance reporting and resolution platform that helps citizens submit infrastructure complaints, follow their progress, and gives authorities a focused workspace to review and resolve reported issues.

[Features](#-what-it-does) · [Tech Stack](#-technology-stack) · [Run Locally](#-run-locally) · [Configuration](#-environment-configuration) · [Project Structure](#-project-structure)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=20232A)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/Project-Portfolio%20Project-0F766E)

</div>

## 📸 Application Screenshots

### Homepage
![Infra-Alert Homepage](docs/screenshots/Home-Page.png)

### Citizen Landing Page
![Citizen Landing Page](docs/screenshots/User_Landing_Page.png)

### Citizen Complaint Form
![Citizen Complaint Form1](docs/screenshots/Complaint_Form1.png)

- View the deatiled images and complaint recipts in the `docs/screenshots`.

### Citizen Dashboard
![Citizen Dashboard](docs/screenshots/User_Dashboard.png)

### Authority Dashboard
![Authority Dashboard](docs/screenshots/Authority_Dashboard.png)

- View the deatiled images and complaint recipts in the `docs/screenshots`.
---

## ✨ Why Infra-Alert?

Civic issues such as damaged roads, drainage problems, garbage accumulation, and faulty streetlights can be difficult to report and follow up on. Infra-Alert provides a single digital workflow for reporting an issue, attaching evidence, sharing its location, and tracking the authority's response.

The project was migrated from a PHP/MySQL application to a modern **React + Vite frontend, Node.js/Express API, and PostgreSQL database**, while retaining its core citizen and authority workflows.

## 🚀 What it does

### For citizens
- **Create an account and sign in** to access a personal complaint workspace.
- **Submit civic complaints** with a category, description, and supporting image.
- **Attach a location** using browser geolocation, view the resolved address, and adjust the map pin when the device's location estimate is inaccurate.
- **Track submitted complaints** and see their current status.
- **Download complaint reports as PDFs**, including available evidence and resolution images.
- **View resolution evidence** when an authority marks a complaint as solved.

### For authorities
- **Register and sign in** through the authority workflow.
- **Review complaints** within the applicable category, department, state, and city scope.
- **Manage complaint status** using the existing workflow: Pending, In Progress, Solved, and Rejected.
- **Attach resolution evidence** when resolving a complaint.

### Supporting capabilities
- Optional **Cloudinary** storage for complaint evidence and resolution images, with local file storage available for local development.
- **Reverse geocoding** to turn coordinates into a readable address, using a configurable provider.
- Responsive interface with role-specific pages and form feedback.

> Location precision depends on the device and browser location source. A readable address is an interpretation of the selected coordinates, not a guarantee of an exact doorstep location. Users can adjust the location pin before submission.

## 📄 Research Publication

Infra-Alert is also the subject of a research paper published through IEEE.

**Paper:** A Web-Based Public Grievance Redressal System with Image and Geolocation Support

**Publication:** 2025 International Conference on Smart & Sustainable Technology (INCSST)

**Publisher:** IEEE

**Conference location:** Chikodi, India

**DOI:** [10.1109/INCSST64791.2025.11210297](https://doi.org/10.1109/INCSST64791.2025.11210297)

The paper explores a web-based approach to public grievance redressal, including complaint submission, image evidence, geolocation tracking, complaint status monitoring, and authority-side resolution workflows.

[Read the published paper on IEEE Xplore](https://ieeexplore.ieee.org/abstract/document/11210297)

## 🧰 Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, React Router, CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL, `pg` |
| Authentication | Express sessions, `bcryptjs` password hashing |
| Image storage | Cloudinary (optional) or local uploads for development |
| Maps and location | Browser Geolocation API, Leaflet, reverse-geocoding provider |
| PDF reports | PDFKit |
| Upload handling | Multer |

## 🏗️ Application architecture

```mermaid
flowchart TD
    A[Citizen / Authority] --> B[React + Vite]
    B -->|HTTP API requests| C[Express API]
    C --> D[(PostgreSQL)]
    C --> E[Cloudinary / Local Uploads]
    C --> F[Reverse Geocoding Provider]
    C --> G[PDF Report Generation]
    G --> B
```

The browser communicates with the Express API. The API owns database access, upload handling, reverse-geocoding requests, authentication/session logic, and PDF generation. Provider secrets belong in the server environment, never in frontend code.

## 🖥️ Run locally

### Prerequisites

- [Node.js](https://nodejs.org/) **20 or newer** (npm is included)
- [PostgreSQL](https://www.postgresql.org/download/) **14 or newer**
- Git (recommended)
- Optional: a [Cloudinary](https://cloudinary.com/) account for hosted images

### 1. Clone the repository

Replace `YOUR_GITHUB_USERNAME` with your GitHub username after you publish the repository.

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/infra-alert.git
cd infra-alert
```

### 2. Create the PostgreSQL database

In pgAdmin, create a database named `infra_alert` with owner `postgres` (or another database user you configure).

Then run `server/schema.sql` against the **`infra_alert`** database. In pgAdmin, select that database, open **Query Tool**, load `server/schema.sql`, and execute it.

The schema creates the application tables:

- `u_register` — citizen accounts
- `auth_register` — authority accounts
- `complaint` — complaint records and current status
- `save_location` — complaint location and related image details
- `solved_img` — resolution image records

The schema creates a fresh application database structure. It does **not** automatically import historical data from the old MySQL database files.

### 3. Configure the server environment

From the project root, copy the environment template.

**Windows PowerShell:**

```powershell
Copy-Item server/.env.example server/.env
```

Open `server/.env` and set your PostgreSQL password and a unique session secret. For example:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/infra_alert
PGSSL=false
PORT=4000
SESSION_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGIN=http://127.0.0.1:5173

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

GEOCODING_PROVIDER=nominatim
GEOCODING_API_KEY=
```

Replace `YOUR_PASSWORD` with the password for your PostgreSQL user. URL-encode reserved characters in the password if necessary; for example, `@` becomes `%40`.

### 4. Install dependencies

Run this once from the project root:

```bash
npm install
```

### 5. Start the application

```bash
npm run dev
```

By default, the development servers use:

- **Frontend:** http://127.0.0.1:5173
- **API health check:** http://127.0.0.1:4000/api/health
- **Integration status:** http://127.0.0.1:4000/api/integrations/status

Keep the terminal running while you use the application.

## 🔐 Environment configuration

### Cloudinary image storage (optional)

1. Create or sign in to a Cloudinary account.
2. Copy the Cloud name, API Key, and API Secret from the Cloudinary Console.
3. Add them to `server/.env`:

   ```dotenv
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. Restart the development server and upload a test complaint image.
5. Verify the uploaded asset appears in Cloudinary and that the complaint retains its image URL.

Keep the API Secret on the server. Never add it to React code or commit it to Git. If Cloudinary is not configured, the application can use local uploads for development.

### Geolocation and reverse geocoding

- The browser requests location permission from the user. A device may provide approximate coordinates, especially on desktop computers.
- The location picker lets the user adjust the map pin when the initial reading is incorrect.
- `GEOCODING_PROVIDER=nominatim` uses the public Nominatim / OpenStreetMap service for low-volume, user-triggered demonstrations. Follow the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and preserve the required OpenStreetMap attribution.
- `GEOCODING_PROVIDER=gomaps` can be used with a valid provider API key if configured for your account.
- `GEOCODING_PROVIDER=none` keeps the coordinates without making a reverse-geocoding request.

A third-party address service cannot make inaccurate device coordinates accurate; verify the point on the map before submitting a complaint.

## 🧪 Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API and Vite frontend together |
| `npm run check` | Check server JavaScript syntax and build the frontend |
| `npm run build` | Build the frontend for production |
| `npm run start` | Start the Express server |

Runtime verification requires PostgreSQL to be running and `server/.env` to be correctly configured. Cloudinary uploads require valid Cloudinary credentials.

## 📁 Project structure

```text
infra-alert/
├── client/
│   ├── src/
│   │   ├── components/     # Shared UI and location picker
│   │   ├── pages/          # Home, auth, citizen and authority pages
│   │   ├── data/           # Department/category data
│   │   ├── api.js           # Frontend API client
│   │   ├── App.jsx          # Routes and role-protected pages
│   │   └── styles.css       # Frontend styles
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/          # Authentication, complaints, location APIs
│   │   ├── middleware/      # Authentication and upload middleware
│   │   ├── lib/             # Password and media helpers
│   │   ├── db.js            # PostgreSQL connection
│   │   └── index.js         # Express server
│   ├── schema.sql
│   └── .env.example
├── package.json
└── README.md
```

## 🔒 Security and responsible use

- Do not commit `.env`, provider secrets, session secrets, private uploads, or real citizen data.
- Use strong local credentials and rotate any provider keys that may have been exposed.
- Obtain consent before requesting a user's location or uploading their images.
- Avoid exposing sensitive complaint details or exact citizen locations through public endpoints.
- Before public production deployment, review HTTPS, secure cookie settings, CSRF/session protections, rate limiting, input validation, access controls, upload limits, backups, provider terms, and privacy requirements.
- Public Nominatim is not intended for bulk or high-traffic geocoding.

Infra-Alert is a portfolio and learning project. A local development setup is not, by itself, a production security or availability audit.

## 🗺️ Potential next steps

- Citizen-confirmed complaint closure and reopening flow
- Duplicate complaint suggestions and community support
- Kannada and English interface options
- Notification preferences and status alerts
- Aggregated neighbourhood civic issue map
- Automated tests for API workflows and permission boundaries

## 👋 About

Built as a full-stack civic-tech project to explore how modern web technologies can make issue reporting, location sharing, evidence collection, and complaint tracking easier to follow.

If you find a bug or have an improvement idea, open a GitHub issue with steps to reproduce it. Please do not include real citizen information, credentials, or private complaint evidence.

---

<div align="center">

**Infra-Alert — making civic issues easier to report and track.**

</div>

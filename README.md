# Infra-Alert — React + Vite + Express + PostgreSQL

This is a migration of the uploaded Infra-Alert PHP/MySQL project. The existing page styling and media assets are retained where possible; the PHP endpoints are rewritten as Express APIs. Table/column names used by the PHP source are preserved (`u_register`, `auth_register`, `complaint`, `save_location`, `solved_img`).

## Stack

- React 18 + Vite
- Node.js + Express
- PostgreSQL (`pg` driver)
- Cookie-based Express sessions for the local application
- Optional Cloudinary image storage; local file storage works without credentials
- PDFKit complaint reports

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer, running locally

## Run locally on Windows

1. Install PostgreSQL and remember the database password you set.
2. Create a database called `infra_alert` in pgAdmin, or from a terminal:

   ```powershell
   createdb -U postgres infra_alert
   ```

3. Open the project folder in VS Code. In PowerShell, copy the environment template:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

4. Edit `server/.env` and set `DATABASE_URL`. Example:

   ```dotenv
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/infra_alert
   PGSSL=false
   PORT=4000
   SESSION_SECRET=replace-this-with-a-long-random-secret
   CLIENT_ORIGIN=http://127.0.0.1:5173
   ```

   URL-encode special characters in the database password (for example, `@` becomes `%40`).

5. Create the five application tables by running `server/schema.sql` against the `infra_alert` database. In pgAdmin: select the database, open Query Tool, open `server/schema.sql`, and execute it. Or use:

   ```powershell
   psql -U postgres -d infra_alert -f server/schema.sql
   ```

6. Install packages at the project root:

   ```powershell
   npm install
   ```

7. Run both the API and Vite client:

   ```powershell
   npm run dev
   ```

8. Open **http://127.0.0.1:5173**. The API health endpoint is **http://127.0.0.1:4000/api/health**.

## Cloudinary image storage

The app already uploads files through the Express backend, so Cloudinary credentials belong only in `server/.env` (never in `client/.env` or React code).

1. Create or sign in to a Cloudinary account at https://cloudinary.com/users/register/free.
2. Open the Cloudinary Console dashboard and copy the **Cloud name**, **API Key**, and **API Secret** from the account's API credentials section.
3. Open `server/.env` and set:

   ```dotenv
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. Save the file and restart `npm run dev` (stop it with `Ctrl+C` first).
5. Open `http://127.0.0.1:4000/api/integrations/status`. When all credentials are loaded, it should say `"imageStorage":"cloudinary"` and `"cloudinaryConfigured":true`.
6. Sign in as a citizen and submit a complaint with a photo. After a successful upload, the complaint's image URL stored in PostgreSQL will be a Cloudinary HTTPS URL, and the new asset should appear in the Cloudinary Media Library under the `infra-alert` folder.
7. To test resolution images, sign in as the matching authority and upload the solved/resolution image. It uses the same Cloudinary folder.

The backend uses Cloudinary's authenticated server-side Node SDK. If credentials are configured but the upload fails, the app now reports a Cloudinary-specific error instead of quietly falling back to a local file. If all three credential values are blank, uploads continue to use `server/uploads` locally.

Official documentation: https://cloudinary.com/documentation/node_integration. Never commit `server/.env` or share the API Secret. The original project archive contained exposed provider credentials; rotate those credentials in the provider dashboards before reusing either account.

## Geolocation and readable address

The complaint form opens a map and tries to center it on the device's current location. The user can move the pin, confirm the point, review the reverse-geocoded address, and submit the selected coordinates with the complaint. Browser location is only an initial map suggestion; the user-confirmed pin is the saved location.

- Use the app on `http://127.0.0.1:5173` or `http://localhost:5173`. Browser geolocation is generally permitted on localhost and HTTPS, but not arbitrary insecure HTTP origins.
- Set `GEOCODING_PROVIDER=locationiq` and `LOCATIONIQ_API_KEY` in `server/.env` to use LocationIQ for reverse geocoding. Keep the key server-side; never add it to client environment variables or commit it. The same key powers authority directions: authorities can use their device location first or enter a starting address, see a LocationIQ driving route in the app, and open it in Google Maps or OpenStreetMap. Directions remain accessible from complaint IDs in every status, including solved complaints.
- If `GEOCODING_PROVIDER` is blank, the app uses LocationIQ when `LOCATIONIQ_API_KEY` is set, otherwise GoMaps when its key is set, and otherwise Nominatim.
- LocationIQ's free tier has daily/rate limits and terms of use; check the current plan and commercial-use restrictions before deployment. Address and route suggestions may be incomplete, so users must verify the complaint pin and authorities should verify directions.
- The default **Nominatim / OpenStreetMap** provider requires no API key and is intended only for modest, user-triggered development/demo usage. The implementation queues requests to about one per second, caches results in memory for a day, and displays attribution.
- Nominatim is a community service with limited capacity. Read and follow its usage policy: https://operations.osmfoundation.org/policies/nominatim/. Do not use it for bulk or high-traffic geocoding. For production/more users, use a suitable geocoding provider or a self-hosted service.
- To use GoMaps instead, set `GEOCODING_PROVIDER=gomaps` and add a fresh `GEOCODING_API_KEY` in `server/.env`. Use a newly generated/restricted key and check that your provider plan allows reverse geocoding. Restart the server afterward.
- To disable reverse lookups while still allowing coordinates to be captured, set `GEOCODING_PROVIDER=none`.

Example `server/.env` settings for the no-key local demo configuration:

```dotenv
GEOCODING_PROVIDER=nominatim
GEOCODING_API_KEY=
LOCATIONIQ_API_KEY=
```

After editing `.env`, stop the development servers with `Ctrl+C` and rerun `npm run dev`. Check `http://127.0.0.1:4000/api/integrations/status`; for this setup it should report `"geocoding":"nominatim"` and `"reverseGeocodingConfigured":true`.

## Data and schema notes

- `server/schema.sql` creates a fresh PostgreSQL schema; it does not recover the old MySQL `.ibd` files or copy historical data automatically.
- The schema uses the table and column names referenced by the original PHP files and avoids adding unverified columns. The exact original MySQL DDL was not included in the ZIP, so a byte-for-byte schema conversion (including unknown column types, defaults and constraints) is not possible from the PHP files alone.
- New passwords are stored as bcrypt hashes. Existing plaintext passwords can still authenticate once; on successful login, the API upgrades that user's password to a hash.
- Complaint IDs retain the `C101`, `C102`, … format. Status values are `Pending`, `In Progress`, `Solved`, and `Rejected`.
- Authority complaint lists are scoped to the authority's category, department, state, and city, matching the original application logic.

## Main workflows

1. Create citizen account → citizen login → choose a category → submit complaint with evidence and a user-confirmed map location.
2. Citizen dashboard lists their own complaints and offers PDF report downloads and a link to the resolution image when solved.
3. Create authority account for a specific category, department, state and city → authority login → see matching pending complaints → move to In Progress, reject, or upload a resolution image and mark Solved.

## Checks

- `npm run check` checks server syntax and builds the Vite client.
- Database/API runtime checks require PostgreSQL to be installed, started, and configured with `server/.env`.

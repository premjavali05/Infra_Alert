import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import { pool, query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/uploads.js';
import { loadImageForPdf, removeLocalUpload, storeUpload } from '../lib/media.js';

const router = Router();
const clean = (value) => String(value ?? '').trim();
const statuses = new Set(['Pending', 'In Progress', 'Solved', 'Rejected']);

function authorityScope(user) {
  return [user.category, user.department, user.state, user.city];
}

async function scopedComplaint(cid, user) {
  const result = await query('SELECT * FROM complaint WHERE cid = $1', [cid]);
  if (!result.rowCount) return null;
  const complaint = result.rows[0];
  if (user.role === 'citizen' && complaint.phno !== user.phno) return null;
  if (user.role === 'authority') {
    const [category, department, state, city] = authorityScope(user);
    if (complaint.category !== category || complaint.dept !== department || complaint.state !== state || complaint.city !== city) return null;
  }
  return complaint;
}

router.get('/mine', requireRole('citizen'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM complaint WHERE phno = $1 ORDER BY date DESC, cid DESC', [req.session.user.phno]
    );
    res.json({ complaints: result.rows });
  } catch (err) { next(err); }
});

router.get('/authority', requireRole('authority'), async (req, res, next) => {
  try {
    const user = req.session.user;
    const params = authorityScope(user);
    const status = clean(req.query.status || 'Pending');
    if (status !== 'all' && !statuses.has(status)) return res.status(400).json({ error: 'Invalid complaint status.' });
    let sql = 'SELECT * FROM complaint WHERE category = $1 AND dept = $2 AND state = $3 AND city = $4';
    if (status !== 'all') {
      params.push(status); sql += ` AND status = $${params.length}`;
    }
    const cid = clean(req.query.cid);
    if (cid) { params.push(cid); sql += ` AND cid ILIKE $${params.length}`; }
    sql += ' ORDER BY date DESC, cid DESC';
    const result = await query(sql, params);
    res.json({ complaints: result.rows, scope: { category: user.category, department: user.department, state: user.state, city: user.city } });
  } catch (err) { next(err); }
});

router.post('/', requireRole('citizen'), upload.single('img_url'), async (req, res, next) => {
  let mediaUrl;
  let uploadedLocally = false;
  try {
    const { name, date, state, category, dept, city, district, description } = req.body;
    const normalized = {
      name: clean(name) || req.session.user.name,
      date: clean(date), state: clean(state), category: clean(category), dept: clean(dept),
      city: clean(city), district: clean(district), description: clean(description)
    };
    if (!normalized.name || !normalized.date || !normalized.state || !normalized.category || !normalized.dept || !normalized.city || !normalized.district || !normalized.description) {
      if (req.file) await removeLocalUpload(req.file);
      return res.status(400).json({ error: 'Complete all required complaint fields.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Please upload a photo or PDF related to the complaint.' });
    mediaUrl = await storeUpload(req.file);
    uploadedLocally = mediaUrl.startsWith('/uploads/');

    const locationData = (() => {
      try {
        const raw = req.body.formData;
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const item = Array.isArray(parsed) ? parsed[0] : parsed;
        if (!item) return null;
        const hasCoordinates = (item.latitude != null && item.longitude != null) || (item.lat != null && item.lng != null);
        return {
          latitude: item.latitude ?? item.lat ?? null,
          longitude: item.longitude ?? item.lng ?? null,
          address: clean(item.address) || (hasCoordinates
            ? 'Address not resolved for selected map coordinates'
            : `${normalized.city}, ${normalized.district}, ${normalized.state}`),
          accuracy: item.accuracy != null && Number.isFinite(Number(item.accuracy)) ? Number(item.accuracy) : null
        };
      } catch { return null; }
    })();

    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      // Serialize C-ID generation so simultaneous submissions do not collide.
      await client.query('SELECT pg_advisory_xact_lock($1)', [71022411]);
      const latest = await client.query("SELECT cid FROM complaint WHERE cid ~ '^C[0-9]+$' ORDER BY SUBSTRING(cid FROM 2)::BIGINT DESC LIMIT 1");
      const lastNumber = latest.rowCount ? Number(latest.rows[0].cid.slice(1)) : 100;
      const cid = `C${lastNumber + 1}`;
      const result = await client.query(
        `INSERT INTO complaint (cid, phno, name, date, state, category, dept, city, district, description, img_url, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending') RETURNING *`,
        [cid, req.session.user.phno, normalized.name, normalized.date, normalized.state, normalized.category,
          normalized.dept, normalized.city, normalized.district, normalized.description, mediaUrl]
      );
      inserted = result.rows[0];
      if (locationData || req.body.latitude || req.body.longitude) {
        const location = locationData || {
          latitude: req.body.latitude || null,
          longitude: req.body.longitude || null,
          address: `${normalized.city}, ${normalized.district}, ${normalized.state}`,
          accuracy: null
        };
        await client.query(
          'INSERT INTO save_location (pno, img_url, latitude, longitude, address, accuracy_m) VALUES ($1,$2,$3,$4,$5,$6)',
          [req.session.user.phno, mediaUrl, location.latitude ?? null, location.longitude ?? null, location.address, location.accuracy]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally { client.release(); }
    res.status(201).json({ message: 'Complaint submitted successfully.', complaint: inserted });
  } catch (err) {
    if (req.file && !uploadedLocally) await removeLocalUpload(req.file);
    next(err);
  }
});

router.get('/:cid/report.pdf', requireAuth, async (req, res, next) => {
  try {
    const complaint = await scopedComplaint(req.params.cid, req.session.user);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const locationResult = await query(
      'SELECT address, latitude, longitude, accuracy_m FROM save_location WHERE pno = $1 AND img_url = $2 LIMIT 1',
      [complaint.phno, complaint.img_url]
    );
    const location = locationResult.rows[0] || null;

    // Resolve image bytes before starting the response so an image fetch can never corrupt PDF headers.
    const [reportedImage, resolutionImage] = await Promise.all([
      loadImageForPdf(complaint.img_url),
      complaint.solved_url ? loadImageForPdf(complaint.solved_url) : Promise.resolve(null)
    ]);

    const logo = await readFile(new URL('../../../client/public/media/logo.png', import.meta.url));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${String(complaint.cid).replace(/[^a-zA-Z0-9_-]/g, '')}-infra-alert.pdf"`);
    const pdf = new PDFDocument({
      margin: 0,
      size: 'A4',
      bufferPages: true,
      info: { Title: `Infra-Alert Complaint Report - ${complaint.cid}`, Author: 'Infra-Alert' }
    });
    pdf.pipe(res);
    const margin = 42;
    const contentWidth = pdf.page.width - margin * 2;
    const pageBottom = pdf.page.height - 54;
    const colors = {
      navy: '#0B1F33',
      teal: '#0F766E',
      text: '#172B4D',
      muted: '#526579',
      border: '#DCE5EC',
      pale: '#F4F7FA',
      white: '#FFFFFF'
    };
    const categoryNames = {
      home_electricity: 'Home Electricity',
      street_lights: 'Street Lights',
      potholes: 'Potholes',
      garbage: 'Garbage'
    };
    const addPageHeader = () => {
      pdf.rect(0, 0, pdf.page.width, 94).fill(colors.navy);
      pdf.rect(0, 94, pdf.page.width, 3).fill(colors.teal);
      pdf.image(logo, margin, 24, { fit: [158, 28] });
      pdf.font('Helvetica-Bold').fontSize(9).fillColor('#BFD1DE')
        .text('COMPLAINT REPORT', pdf.page.width - margin - 180, 27, { width: 180, align: 'right', characterSpacing: 1.2 });
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(colors.white)
        .text(`${complaint.cid}  ·  ${complaint.status}`, pdf.page.width - margin - 220, 48, { width: 220, align: 'right' });
      pdf.y = 120;
    };
    const nextPage = () => {
      pdf.addPage();
      addPageHeader();
    };
    const ensureSpace = (height) => {
      if (pdf.y + height > pageBottom) nextPage();
    };
    const sectionHeading = (title) => {
      ensureSpace(34);
      pdf.font('Helvetica-Bold').fontSize(10).fillColor(colors.teal)
        .text(title.toUpperCase(), margin, pdf.y, { characterSpacing: 0.8 });
      const ruleY = pdf.y + 7;
      pdf.moveTo(margin, ruleY).lineTo(pdf.page.width - margin, ruleY).lineWidth(0.7).strokeColor(colors.border).stroke();
      pdf.y = ruleY + 14;
    };

    const coordinateText = location && location.latitude != null && location.longitude != null
      ? `${Number(location.latitude).toFixed(7)}, ${Number(location.longitude).toFixed(7)}`
      : 'Not captured';
    const accuracyText = location?.accuracy_m != null
      ? `±${Math.round(Number(location.accuracy_m))} metres (device estimate)`
      : 'Not recorded';
    const formatValue = (value) => {
      if (value == null || String(value).trim() === '') return '—';
      return String(value).trim();
    };
    const drawInfoRow = (entries) => {
      const cellWidth = (contentWidth - 10) / 2;
      const values = [...entries];
      while (values.length < 2) values.push(['', '']);
      const heights = values.map(([label, value]) => {
        if (!label) return 0;
        const body = formatValue(value);
        const bodyHeight = pdf.font('Helvetica').fontSize(10)
          .heightOfString(body, { width: cellWidth - 22, lineGap: 2 });
        return Math.max(49, 29 + bodyHeight);
      });
      const rowHeight = Math.max(...heights);
      ensureSpace(rowHeight + 9);
      const top = pdf.y;
      values.forEach(([label, value], index) => {
        if (!label) return;
        const x = margin + index * (cellWidth + 10);
        pdf.roundedRect(x, top, cellWidth, rowHeight, 5).lineWidth(0.65).strokeColor(colors.border).stroke();
        pdf.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted)
          .text(label.toUpperCase(), x + 11, top + 8, { width: cellWidth - 22, characterSpacing: 0.35 });
        pdf.font('Helvetica').fontSize(10).fillColor(colors.text)
          .text(formatValue(value), x + 11, top + 21, { width: cellWidth - 22, lineGap: 2 });
      });
      pdf.y = top + rowHeight + 9;
    };
    const drawFullWidth = (label, value) => {
      const body = formatValue(value);
      const bodyHeight = pdf.font('Helvetica').fontSize(10)
        .heightOfString(body, { width: contentWidth - 24, lineGap: 2 });
      const boxHeight = Math.max(53, bodyHeight + 34);
      ensureSpace(boxHeight + 9);
      const top = pdf.y;
      pdf.roundedRect(margin, top, contentWidth, boxHeight, 5).fillAndStroke(colors.pale, colors.border);
      pdf.font('Helvetica-Bold').fontSize(8).fillColor(colors.muted)
        .text(label.toUpperCase(), margin + 12, top + 9, { width: contentWidth - 24, characterSpacing: 0.35 });
      pdf.font('Helvetica').fontSize(10).fillColor(colors.text)
        .text(body, margin + 12, top + 23, { width: contentWidth - 24, lineGap: 2 });
      pdf.y = top + boxHeight + 9;
    };

    const addImageSection = (title, imageBytes) => {
      sectionHeading(title);
      const boxHeight = 248;
      ensureSpace(boxHeight + 4);
      const top = pdf.y;
      pdf.roundedRect(margin, top, contentWidth, boxHeight, 6).lineWidth(0.7).strokeColor(colors.border).stroke();
      if (!imageBytes) {
        pdf.font('Helvetica').fontSize(10).fillColor(colors.muted)
          .text('No image preview is available for this report.', margin + 14, top + 18, { width: contentWidth - 28 });
      } else {
        try {
          pdf.image(imageBytes, margin + 12, top + 12, {
            fit: [contentWidth - 24, boxHeight - 24],
            align: 'center',
            valign: 'center'
          });
        } catch (error) {
          console.warn(`[pdf] Could not embed ${title.toLowerCase()} for ${complaint.cid}:`, error.message);
          pdf.font('Helvetica').fontSize(10).fillColor(colors.muted)
            .text('Image preview could not be embedded. Upload a JPEG or PNG image to include it in the report.', margin + 14, top + 18, { width: contentWidth - 28 });
        }
      }
      pdf.y = top + boxHeight + 16;
    };

    addPageHeader();
    sectionHeading('Complaint details');
    drawInfoRow([['Complaint ID', complaint.cid], ['Status', complaint.status]]);
    drawInfoRow([['Date reported', String(complaint.date).slice(0, 10)], ['Category', categoryNames[complaint.category] || complaint.category]]);
    drawInfoRow([['Citizen', complaint.name], ['Phone', complaint.phno]]);
    drawInfoRow([['Department', complaint.dept], ['State', complaint.state]]);
    drawInfoRow([['City', complaint.city], ['District', complaint.district]]);

    sectionHeading('Issue description');
    drawFullWidth('Description', complaint.description);

    sectionHeading('Reported location');
    drawFullWidth('Address', location?.address || 'Location not captured');
    drawInfoRow([['Coordinates (latitude, longitude)', coordinateText], ['Estimated GPS accuracy', accuracyText]]);

    const addImageSectionWithSpace = (title, imageBytes) => {
      ensureSpace(34 + 248 + 4);
      addImageSection(title, imageBytes);
    };
    addImageSectionWithSpace('Reported evidence', reportedImage);
    if (complaint.solved_url) addImageSectionWithSpace('Resolution evidence', resolutionImage);

    const pageRange = pdf.bufferedPageRange();
    for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
      pdf.switchToPage(index);
      const footerY = pdf.page.height - 36;
      pdf.moveTo(margin, footerY - 8).lineTo(pdf.page.width - margin, footerY - 8)
        .lineWidth(0.65).strokeColor(colors.border).stroke();
      pdf.font('Helvetica').fontSize(8).fillColor(colors.muted)
        .text('Infra-Alert  ·  Complaint Report', margin, footerY, { lineBreak: false });
      pdf.text(`Page ${index + 1} of ${pageRange.count}`, pdf.page.width - margin - 100, footerY, { width: 100, align: 'right', lineBreak: false });
    }
    pdf.end();
  } catch (err) { next(err); }
});

router.get('/:cid', requireAuth, async (req, res, next) => {
  try {
    const complaint = await scopedComplaint(req.params.cid, req.session.user);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const location = await query('SELECT * FROM save_location WHERE pno = $1 AND img_url = $2 LIMIT 1', [complaint.phno, complaint.img_url]);
    res.json({ complaint, location: location.rows[0] ?? null });
  } catch (err) { next(err); }
});

router.patch('/:cid/status', requireRole('authority'), async (req, res, next) => {
  try {
    const action = clean(req.body.action);
    const complaint = await scopedComplaint(req.params.cid, req.session.user);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found in your department scope.' });
    let nextStatus;
    if (action === 'in-progress' && complaint.status === 'Pending') nextStatus = 'In Progress';
    else if (action === 'reject' && ['Pending', 'In Progress'].includes(complaint.status)) nextStatus = 'Rejected';
    else return res.status(409).json({ error: 'This complaint has already changed status or the action is not allowed.' });
    const result = await query('UPDATE complaint SET status = $1 WHERE cid = $2 RETURNING *', [nextStatus, complaint.cid]);
    res.json({ message: `Complaint marked ${nextStatus.toLowerCase()}.`, complaint: result.rows[0] });
  } catch (err) { next(err); }
});

router.post('/:cid/solve', requireRole('authority'), upload.single('img'), async (req, res, next) => {
  try {
    const complaint = await scopedComplaint(req.params.cid, req.session.user);
    if (!complaint) {
      if (req.file) await removeLocalUpload(req.file);
      return res.status(404).json({ error: 'Complaint not found in your department scope.' });
    }
    if (!['Pending', 'In Progress'].includes(complaint.status)) {
      if (req.file) await removeLocalUpload(req.file);
      return res.status(409).json({ error: 'Only pending or in-progress complaints can be marked solved.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Upload a resolution image before marking the complaint solved.' });
    const url = await storeUpload(req.file);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query("UPDATE complaint SET status = 'Solved', solved_url = $1 WHERE cid = $2 RETURNING *", [url, complaint.cid]);
      await client.query('INSERT INTO solved_img (cid, eid, solved_url) VALUES ($1,$2,$3)', [complaint.cid, req.session.user.eid, url]);
      await client.query('COMMIT');
      res.json({ message: 'Complaint marked solved.', complaint: updated.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally { client.release(); }
  } catch (err) { next(err); }
});

export default router;

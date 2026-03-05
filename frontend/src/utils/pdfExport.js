// Plain JS utility — no JSX, no React.
// Kept separate so the Emergent babel metadata plugin (which only processes
// React component files) never touches the jsPDF import.
import { jsPDF }   from 'jspdf';
import autoTable   from 'jspdf-autotable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function exportLeadsToPdf(contactsToExport, filterLabel, timezone) {
  if (!contactsToExport.length) throw new Error('No leads to export');

  // Send only the IDs we need — avoids fetching thousands of unused contacts
  const ids    = contactsToExport.map(c => c.contact_id);
  const params = new URLSearchParams({ limit: String(ids.length + 10) });
  ids.forEach(id => params.append('ids', id));
  const res = await fetch(`${BACKEND_URL}/api/leads/export?${params}`);
  if (!res.ok) throw new Error(`Export API returned ${res.status}: ${await res.text()}`);
  const allData = await res.json();
  if (!Array.isArray(allData)) throw new Error(`Unexpected API response: ${JSON.stringify(allData).slice(0, 200)}`);

  // allData already contains only the requested IDs — no client-side filter needed
  const data = allData;
  if (!data.length) throw new Error('None of the selected leads were found in the export');

  const NAVY  = [3, 3, 82];
  const RED   = [163, 24, 0];
  const GREEN = [5, 150, 105];
  const GRAY  = [100, 100, 110];
  const PW    = 170; // printable width in mm (A4 = 210, 20mm margins each side)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Cover header ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('TETHER', 20, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...GRAY);
  doc.text('Lead Export', 20, 29);

  doc.setFontSize(8.5);
  const nowStr = new Date().toLocaleString('en-US', {
    timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  doc.text(`Generated: ${nowStr}  ·  Timezone: ${timezone}`, 20, 36);
  let headerY = 37;
  if (filterLabel) { doc.text(`Date filter: ${filterLabel}`, 20, (headerY = 41)); headerY = 42; }
  doc.text(`${data.length} lead${data.length !== 1 ? 's' : ''}`, 20, headerY + 4);
  const divY = headerY + 8;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(20, divY, 190, divY);

  let y = divY + 6;

  // ── Per-lead sections ───────────────────────────────────────────────────────
  for (let idx = 0; idx < data.length; idx++) {
    const c = data[idx];
    if (y > 240) { doc.addPage(); y = 20; }

    // Lead heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    const title = `${idx + 1}. ${c.name || 'Anonymous'}${c.email ? `  <${c.email}>` : ''}`;
    doc.text(title, 20, y);
    y += 6;

    // 1. Contact Information
    const fmt = (ts) => ts ? new Date(ts).toLocaleString('en-US', {
      timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : '—';

    const infoRows = [
      ['Name',        c.name        || '—'],
      ['Email',       c.email       || '—'],
      ['Phone',       c.phone       || '—'],
      ['Contact ID',  c.contact_id  || '—'],
      ['IP Address',  c.client_ip   || '—'],
      ['Session ID',  c.session_id  || '—'],
      ['First Seen',  fmt(c.created_at)],
      ['Last Active', fmt(c.updated_at)],
    ];
    if (c.tags?.length) infoRows.push(['Tags', c.tags.join(', ')]);

    autoTable(doc, {
      startY:  y,
      head:    [['Contact Information', '']],
      body:    infoRows,
      theme:   'grid',
      headStyles:         { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
      bodyStyles:         { fontSize: 8, cellPadding: 2, textColor: [30, 30, 40] },
      alternateRowStyles: { fillColor: [246, 247, 252] },
      columnStyles:       { 0: { cellWidth: 32, fontStyle: 'bold', textColor: GRAY }, 1: { cellWidth: PW - 32 } },
      margin:             { left: 20, right: 20 },
    });
    y = doc.lastAutoTable.finalY + 4;

    // 2. Stitch Information
    if (c.merged_children?.length) {
      if (y > 250) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY:  y,
        head:    [['#', 'Stitched Contact ID (merged into this lead)']],
        body:    c.merged_children.map((cid, i) => [i + 1, cid]),
        theme:   'grid',
        headStyles:   { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
        bodyStyles:   { fontSize: 7.5, cellPadding: 2, textColor: [30, 30, 40] },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: PW - 8 } },
        margin:       { left: 20, right: 20 },
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    // 3. URL History
    if (c.visits?.length) {
      if (y > 250) { doc.addPage(); y = 20; }
      const fmtTs = (ts) => ts ? new Date(ts).toLocaleString('en-US', {
        timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }) : '—';

      autoTable(doc, {
        startY:  y,
        head:    [['#', 'Date / Time', 'URL Visited']],
        body:    c.visits.map((v, i) => [i + 1, fmtTs(v.timestamp), v.url || '—']),
        theme:   'grid',
        headStyles:         { fillColor: RED, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
        bodyStyles:         { fontSize: 7.5, cellPadding: 2, textColor: [30, 30, 40] },
        alternateRowStyles: { fillColor: [255, 248, 247] },
        columnStyles:       { 0: { cellWidth: 8 }, 1: { cellWidth: 42 }, 2: { cellWidth: PW - 50 } },
        styles:             { overflow: 'linebreak' },
        margin:             { left: 20, right: 20 },
      });
      y = doc.lastAutoTable.finalY + 4;
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text('No URL visits recorded.', 22, y + 3);
      y += 9;
    }

    // Separator
    if (idx < data.length - 1) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setDrawColor(210, 212, 228);
      doc.setLineWidth(0.25);
      doc.line(20, y + 2, 190, y + 2);
      y += 10;
    }
  }

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180);
    doc.text(`Tether Lead Export  ·  Page ${p} of ${totalPages}`, 105, 292, { align: 'center' });
  }

  const fname = `tether-leads-${localDateStr(new Date())}.pdf`;
  doc.save(fname);
  return { fname, count: data.length };
}

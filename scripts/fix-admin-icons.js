const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'src', 'app', 'features', 'admin', 'admin-dashboard.component.html');
let content = fs.readFileSync(targetFile, 'utf8');

const editSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const clockSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px; display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

// Replace any occurrence of the corrupted edit prefix
content = content.replace(/[^\x00-\x7F]+\s*Edit Price/g, editSvg + 'Edit Price');
content = content.replace(/[^\x00-\x7F]+\s*Edit Rate/g, editSvg + 'Edit Rate');
content = content.replace(/[^\x00-\x7F]+\s*Edit/g, editSvg + 'Edit');

// Replace any occurrence of the corrupted pending / clock prefix
content = content.replace(/[^\x00-\x7F]+\s*Pending Approval/g, clockSvg + 'Pending Approval');
content = content.replace(/[^\x00-\x7F]+\s*Pending/g, clockSvg + 'Pending');
content = content.replace(/[^\x00-\x7F]+\s*(\{\{\s*(?:ord|b)\.statusHistory)/g, clockSvg + '$1');

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully cleaned and replaced corrupted glyphs in admin dashboard!');

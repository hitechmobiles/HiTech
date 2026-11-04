const { checkSecurity } = require('./_security');
const fs = require('fs');
const path = require('path');

function interpolateTemplate(templateHtml, variables) {
  let result = templateHtml;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value ?? '');
  }
  return result;
}

function loadTemplate(filename, fallbackFn, vars) {
  try {
    const templatePath = path.join(process.cwd(), 'email-templates', filename);
    if (fs.existsSync(templatePath)) {
      const raw = fs.readFileSync(templatePath, 'utf8');
      return interpolateTemplate(raw, vars);
    }
  } catch (e) {}
  return fallbackFn(vars);
}

function generateAdminHtml(vars) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#334155;">
  <div style="max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;">
    <h2 style="color:#7c3aed;">🏬 New Shop Registration: ${vars.shop_name || ''}</h2>
    <p><strong>Proprietor:</strong> ${vars.owner_name || ''}</p>
    <p><strong>Email:</strong> ${vars.applicant_email || ''}</p>
    <p><strong>Phone:</strong> ${vars.phone || ''}</p>
    <p><strong>Location:</strong> ${vars.location || ''}</p>
    <p><strong>GST:</strong> ${vars.gst_number || 'Not Provided'}</p>
    <p><strong>Date:</strong> ${vars.registration_date || ''}</p>
    <p><a href="https://hitechmobiles.tech/admin" style="background:#7c3aed;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block;">Open Admin Portal</a></p>
  </div></body></html>`;
}

function generateApplicantHtml(vars) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#334155;">
  <div style="max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;">
    <h2 style="color:#1a8fe3;">🎉 Wholesale Application Received: ${vars.shop_name || ''}</h2>
    <p>Hello ${vars.owner_name || ''}, thank you for registering with HiTech Wholesale Network!</p>
    <p>Our admin team is verifying your application and will dispatch your credentials shortly.</p>
  </div></body></html>`;
}

async function sendResendMail(apiKey, fromEmail, toEmail, subject, htmlContent) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      html: htmlContent
    })
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

module.exports = async function handler(req, res) {
  // Enterprise Attack & DDoS Protection
  const secCheck = checkSecurity(req, res);
  if (!secCheck.allowed) {
    return res.status(secCheck.status).json({ error: secCheck.error });
  }
  const reqOrigin = req.headers.origin || '';
  const isAllowedOrigin = (orig) => {
    if (!orig) return true;
    if (orig.includes('localhost') || orig.includes('127.0.0.1')) return true;
    if (orig.endsWith('.vercel.app')) return true;
    if (orig.includes('hitechmobiles') || orig.includes('hitech')) return true;
    return false;
  };

  const allowedOrigin = isAllowedOrigin(reqOrigin) && reqOrigin ? reqOrigin : '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  if (allowedOrigin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, X-HiTech-Client');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const { form, owner } = req.body || {};
  if (!form || !form.shopName || !form.ownerName || !form.email) {
    return res.status(400).json({ error: 'Missing mandatory registration fields (shopName, ownerName, email).' });
  }

  const newOwner = owner || {
    id: 'owner-' + Date.now(),
    email: form.email.trim(),
    defaultPasswordPlain: '',
    role: 'shopowner',
    shopName: form.shopName.trim(),
    ownerName: form.ownerName.trim(),
    phone: form.phone ? form.phone.trim() : '',
    location: form.location ? form.location.trim() : '',
    shopPhoto: form.shopPhoto || 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=800&q=80',
    gstNumber: form.gstNumber ? form.gstNumber.trim() : '',
    status: 'pending',
    registeredDate: new Date().toISOString().split('T')[0],
    bulkDiscountTier: 'Silver (10% OFF)'
  };

  const nowStr = new Date().toLocaleString('en-IN');
  const templateVars = {
    shop_name: newOwner.shopName,
    owner_name: newOwner.ownerName,
    applicant_email: newOwner.email,
    phone: newOwner.phone || 'N/A',
    location: newOwner.location || 'N/A',
    gst_number: newOwner.gstNumber || 'Not Provided',
    discount_tier: newOwner.bulkDiscountTier,
    additional_notes: form.additionalNotes || 'None',
    shop_photo: newOwner.shopPhoto,
    registration_date: nowStr
  };

  // 1. Send Email Notifications via Resend
  const apiKey = process.env.RESEND_API_KEY || '';
  const adminEmail = process.env.RESEND_TO_EMAIL || 'hitechmobilesandservice@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'HiTech Mobiles <noreply@hitechmobiles.tech>';
  let adminEmailResult = null;
  let applicantEmailResult = null;

  if (apiKey) {
    try {
      const adminSubject = `🏬 New Shop Partner Registration: ${newOwner.shopName} - ${newOwner.ownerName}`;
      const adminHtml = loadTemplate('shop-registration-admin.html', generateAdminHtml, templateVars);
      adminEmailResult = await sendResendMail(apiKey, fromEmail, adminEmail, adminSubject, adminHtml);

      if (newOwner.email && newOwner.email.includes('@') && newOwner.email !== adminEmail) {
        const applicantSubject = `🎉 Wholesale Partner Application Received — ${newOwner.shopName} | HiTech Mobiles`;
        const applicantHtml = loadTemplate('shop-registration-applicant.html', generateApplicantHtml, templateVars);
        applicantEmailResult = await sendResendMail(apiKey, fromEmail, newOwner.email, applicantSubject, applicantHtml);
      }
    } catch (mailErr) {
      console.warn('Error sending registration emails:', mailErr);
    }
  }

  // 2. Immediate Code-Level Sync (GitHub Commit & Workflow Dispatch)
  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const repoOwner = process.env.GITHUB_OWNER || 'hitechmobiles';
  const repoName = process.env.GITHUB_REPO || 'HiTech';
  const targetBranch = process.env.GITHUB_BRANCH || 'main';
  let githubSynced = false;
  let githubMessage = '';

  if (githubToken) {
    try {
      const filePath = 'public/data/shop-owners.json';
      const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
      const ghHeaders = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'HiTech-Serverless-Register',
        'Content-Type': 'application/json'
      };

      // Fetch existing file
      const getRes = await fetch(`${apiUrl}?ref=${targetBranch}`, { headers: ghHeaders });
      if (getRes.ok) {
        const fileData = await getRes.json();
        const contentStr = Buffer.from(fileData.content, 'base64').toString('utf8');
        const ownersList = JSON.parse(contentStr);

        // Prepend new pending shop owner if not already present
        const exists = ownersList.some(o => o.email?.toLowerCase() === newOwner.email.toLowerCase() || o.id === newOwner.id);
        if (!exists) {
          ownersList.unshift(newOwner);
          const updatedBase64 = Buffer.from(JSON.stringify(ownersList, null, 2)).toString('base64');

          const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
              message: `feat(shop): new wholesale partner registration - ${newOwner.shopName}`,
              content: updatedBase64,
              sha: fileData.sha,
              branch: targetBranch
            })
          });

          if (putRes.ok) {
            githubSynced = true;
            githubMessage = `Committed to ${repoOwner}/${repoName}@${targetBranch}`;

            // Trigger immediate pipeline
            try {
              const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/admin-publish-immediate.yml/dispatches`;
              await fetch(dispatchUrl, {
                method: 'POST',
                headers: ghHeaders,
                body: JSON.stringify({
                  ref: targetBranch,
                  inputs: {
                    trigger_reason: `Partner registration - ${newOwner.shopName}`,
                    actor_email: newOwner.email
                  }
                })
              });
            } catch (dispatchErr) {
              console.warn('Pipeline dispatch notice:', dispatchErr?.message);
            }
          }
        }
      }
    } catch (ghErr) {
      console.warn('GitHub serverless sync error:', ghErr?.message);
      githubMessage = ghErr?.message || 'Sync failed';
    }
  }

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event: 'SHOP_REGISTRATION_SUCCESS', shopName: form.shopName, email: form.email }));
      return res.status(200).json({
    success: true,
    owner: newOwner,
    adminEmailed: adminEmailResult ? adminEmailResult.ok : false,
    applicantEmailed: applicantEmailResult ? applicantEmailResult.ok : false,
    githubSynced,
    githubMessage: githubMessage || (githubToken ? 'Synced' : 'GitHub token not in environment (local/client sync active)')
  });
};

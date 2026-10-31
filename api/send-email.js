const fs = require('fs');
const path = require('path');

// Helper to fill template variables
function interpolateTemplate(templateHtml, variables) {
  let result = templateHtml;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value ?? '');
  }
  return result;
}

// Fallback HTML generators
function generateAdminOrderHtml(vars) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#334155;">
  <div style="max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;">
    <h2 style="color:#1a8fe3;">🛒 New Store Order #${vars.order_number || ''}</h2>
    <p><strong>Customer:</strong> ${vars.customer_name || ''} (${vars.customer_phone || ''})</p>
    <p><strong>Email:</strong> ${vars.customer_email || 'N/A'}</p>
    <p><strong>Address:</strong> ${vars.delivery_address || ''}</p>
    <hr/><pre style="background:#f8fafc;padding:12px;border-radius:6px;">${vars.items_summary || ''}</pre>
    <h3>Total Amount: ${vars.total_amount || ''}</h3>
    <p style="color:#64748b;font-size:12px;">Placed on: ${vars.order_date || ''} (${vars.order_type || ''})</p>
  </div></body></html>`;
}

function generateCustomerOrderHtml(vars) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#334155;">
  <div style="max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;">
    <h2 style="color:#0284c7;">✅ Order Confirmation #${vars.order_number || ''}</h2>
    <p>Hello ${vars.customer_name || ''}, thank you for your order with HiTech!</p>
    <hr/><pre style="background:#f8fafc;padding:12px;border-radius:6px;">${vars.items_summary || ''}</pre>
    <h3>Total: ${vars.total_amount || ''}</h3>
    <p><strong>Delivery to:</strong> ${vars.delivery_address || ''}</p>
    <p style="color:#64748b;font-size:12px;">Support: bhuvaneshwaranaj@gmail.com</p>
  </div></body></html>`;
}

function generateAdminBookingHtml(vars) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#334155;">
  <div style="max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;">
    <h2 style="color:#7c3aed;">🔧 New Service Booking #${vars.booking_id || ''}</h2>
    <p><strong>Service:</strong> ${vars.service_name || ''}</p>
    <p><strong>Device:</strong> ${vars.device_model || ''}</p>
    <p><strong>Issue:</strong> ${vars.issue_description || ''}</p>
    <p><strong>Customer:</strong> ${vars.customer_name || ''} (${vars.customer_phone || ''})</p>
    <p><strong>Address:</strong> ${vars.customer_address || ''} (${vars.pincode || ''})</p>
    <p><strong>Slot:</strong> ${vars.preferred_slot || ''} &bull; Mode: ${vars.fulfillment_mode || ''}</p>
    <h3>Estimated Quote: ${vars.estimated_price || ''}</h3>
  </div></body></html>`;
}

function generateCustomerBookingHtml(vars) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#0f172a;color:#334155;">
  <div style="max-width:600px;margin:auto;background:#fff;padding:24px;border-radius:12px;">
    <h2 style="color:#7c3aed;">📱 Appointment Confirmed #${vars.booking_id || ''}</h2>
    <p>Hello ${vars.customer_name || ''}, your service appointment for <strong>${vars.service_name || ''}</strong> (${vars.device_model || ''}) is confirmed.</p>
    <p><strong>Preferred Slot:</strong> ${vars.preferred_slot || ''}</p>
    <p><strong>Mode:</strong> ${vars.fulfillment_mode || ''}</p>
    <p><strong>Estimated Quote:</strong> ${vars.estimated_price || ''}</p>
    <p style="color:#64748b;font-size:12px;">Our team will contact you at ${vars.customer_phone || ''}. Support: bhuvaneshwaranaj@gmail.com</p>
  </div></body></html>`;
}

function loadTemplate(filename, fallbackFn, vars) {
  try {
    const templatePath = path.join(process.cwd(), 'email-templates', filename);
    if (fs.existsSync(templatePath)) {
      const raw = fs.readFileSync(templatePath, 'utf8');
      return interpolateTemplate(raw, vars);
    }
  } catch (e) {
    // fallback
  }
  return fallbackFn(vars);
}

// Helper to call Resend API
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
  // 1. Standard-Compliant CORS Configuration & Origin Validation
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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, X-HiTech-Client, X-CSRF-Token'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const apiKey = process.env.RESEND_API_KEY || '';
  const adminEmail = process.env.RESEND_TO_EMAIL || 'hitechmobilesandservice@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'HiTech <onboarding@resend.dev>';

  try {
    const { type, recipient, subject, templateParams } = req.body || {};

    if (!type || !templateParams) {
      return res.status(400).json({
        error: 'Missing required fields: type and templateParams are required.'
      });
    }

    if (!apiKey) {
      console.warn('RESEND_API_KEY is not defined in environment variables. Simulating email dispatch.');
      return res.status(200).json({
        success: true,
        simulated: true,
        message: 'RESEND_API_KEY is not configured. Email simulated locally.'
      });
    }

    const targetAdmin = recipient || adminEmail;
    const customerEmail = templateParams.customer_email?.trim();
    let adminResult = null;
    let customerResult = null;

    if (type === 'ORDER_NOTIFICATION') {
      // 1. Dispatch Admin Notification
      const adminSubject = subject || `🛒 New Order Placed: #${templateParams.order_number || ''} - ${templateParams.customer_name || ''}`;
      const adminHtml = loadTemplate('order-notification.html', generateAdminOrderHtml, templateParams);
      adminResult = await sendResendMail(apiKey, fromEmail, targetAdmin, adminSubject, adminHtml);

      // 2. Dispatch Customer Confirmation (if customer email provided and valid)
      if (customerEmail && customerEmail.includes('@') && customerEmail !== targetAdmin) {
        try {
          const custSubject = `✅ Order Confirmation #${templateParams.order_number || ''} - HiTech Mobiles`;
          const custHtml = loadTemplate('order-customer-confirmation.html', generateCustomerOrderHtml, templateParams);
          customerResult = await sendResendMail(apiKey, fromEmail, customerEmail, custSubject, custHtml);
          if (!customerResult.ok) {
            console.warn(`Customer confirmation could not be sent to ${customerEmail}:`, customerResult.data?.message || customerResult.data);
          }
        } catch (err) {
          console.warn(`Failed customer email delivery to ${customerEmail}:`, err?.message);
        }
      }

    } else if (type === 'SERVICE_BOOKING') {
      // 1. Dispatch Admin Notification
      const adminSubject = subject || `🔧 Service Appointment: ${templateParams.service_name || ''} - ${templateParams.customer_name || ''}`;
      const adminHtml = loadTemplate('service-booking-notification.html', generateAdminBookingHtml, templateParams);
      adminResult = await sendResendMail(apiKey, fromEmail, targetAdmin, adminSubject, adminHtml);

      // 2. Dispatch Customer Confirmation
      if (customerEmail && customerEmail.includes('@') && customerEmail !== targetAdmin) {
        try {
          const custSubject = `📱 Service Booking Confirmation #${templateParams.booking_id || ''} - HiTech Care`;
          const custHtml = loadTemplate('service-booking-customer.html', generateCustomerBookingHtml, templateParams);
          customerResult = await sendResendMail(apiKey, fromEmail, customerEmail, custSubject, custHtml);
          if (!customerResult.ok) {
            console.warn(`Customer booking confirmation could not be sent to ${customerEmail}:`, customerResult.data?.message || customerResult.data);
          }
        } catch (err) {
          console.warn(`Failed customer email delivery to ${customerEmail}:`, err?.message);
        }
      }
    } else if (type === 'PRODUCT_SEARCH_REQUEST') {
      // 1. Dispatch Admin Notification for Sourcing
      const adminSubject = subject || `🔍 Customer Product Request: ${templateParams.requested_product || ''} - ${templateParams.customer_name || ''}`;
      const adminHtml = loadTemplate('product-request-admin.html', vars => `
        <div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:10px;">
          <h2 style="color:#38bdf8;">🔍 New Product / Phone Request</h2>
          <p><strong>Device:</strong> ${vars.requested_product || ''}</p>
          <p><strong>Customer:</strong> ${vars.customer_name || ''} (${vars.customer_phone || ''})</p>
          <p><strong>Email:</strong> ${vars.customer_email || 'N/A'}</p>
          <p><strong>Notes:</strong> ${vars.customer_notes || 'N/A'}</p>
          <p style="color:#94a3b8;font-size:12px;">Submitted on: ${vars.request_date || ''}</p>
        </div>
      `, templateParams);
      adminResult = await sendResendMail(apiKey, fromEmail, targetAdmin, adminSubject, adminHtml);

      // 2. Dispatch Customer Confirmation
      if (customerEmail && customerEmail.includes('@') && customerEmail !== targetAdmin) {
        try {
          const custSubject = `📱 We Received Your Request: ${templateParams.requested_product || ''} - HiTech Mobiles`;
          const custHtml = loadTemplate('product-request-customer.html', vars => `
            <div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:10px;">
              <h2 style="color:#38bdf8;">We Received Your Product Request! 📱</h2>
              <p>Hello ${vars.customer_name || ''}, thank you for requesting <strong>${vars.requested_product || ''}</strong>.</p>
              <p>Our team is checking wholesale availability and will contact you shortly at ${vars.customer_phone || ''}.</p>
            </div>
          `, templateParams);
          customerResult = await sendResendMail(apiKey, fromEmail, customerEmail, custSubject, custHtml);
        } catch (err) {
          console.warn(`Failed customer email delivery to ${customerEmail}:`, err?.message);
        }
      }

    } else if (type === 'CUSTOM_SERVICE_ISSUE') {
      // 1. Dispatch Admin Notification for Custom Issue
      const adminSubject = subject || `🔧 Custom Repair Booking: ${templateParams.custom_issue_title || templateParams.service_name || ''} - ${templateParams.customer_name || ''}`;
      const adminHtml = loadTemplate('custom-issue-admin.html', vars => `
        <div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:10px;">
          <h2 style="color:#c084fc;">🔧 New Custom Issue Repair Booking #${vars.booking_id || ''}</h2>
          <p><strong>Custom Issue:</strong> ${vars.custom_issue_title || ''}</p>
          <p><strong>Device:</strong> ${vars.device_model || ''}</p>
          <p><strong>Customer:</strong> ${vars.customer_name || ''} (${vars.customer_phone || ''})</p>
          <p><strong>Description:</strong> ${vars.issue_description || ''}</p>
          <p><strong>Preferred Slot:</strong> ${vars.preferred_slot || ''} &bull; Mode: ${vars.fulfillment_mode || ''}</p>
        </div>
      `, templateParams);
      adminResult = await sendResendMail(apiKey, fromEmail, targetAdmin, adminSubject, adminHtml);

      // 2. Dispatch Customer Confirmation
      if (customerEmail && customerEmail.includes('@') && customerEmail !== targetAdmin) {
        try {
          const custSubject = `🔧 Custom Service Booking Confirmed #${templateParams.booking_id || ''} - HiTech Care`;
          const custHtml = loadTemplate('custom-issue-customer.html', vars => `
            <div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:10px;">
              <h2 style="color:#c084fc;">Custom Repair Appointment Confirmed! 🔧</h2>
              <p>Hello ${vars.customer_name || ''}, your custom repair for <strong>${vars.custom_issue_title || ''}</strong> (${vars.device_model || ''}) is booked.</p>
              <p>A certified engineer will contact you shortly.</p>
            </div>
          `, templateParams);
          customerResult = await sendResendMail(apiKey, fromEmail, customerEmail, custSubject, custHtml);
        } catch (err) {
          console.warn(`Failed customer email delivery to ${customerEmail}:`, err?.message);
        }
      }

    } else {
      // Generic dispatch
      const genericHtml = `<pre>${JSON.stringify(templateParams, null, 2)}</pre>`;
      adminResult = await sendResendMail(apiKey, fromEmail, targetAdmin, subject || 'HiTech Notification', genericHtml);
    }

    if (!adminResult || !adminResult.ok) {
      console.error('Admin email dispatch error:', adminResult?.data);
      return res.status(adminResult?.status || 500).json({
        success: false,
        error: adminResult?.data?.message || 'Failed to dispatch email via Resend'
      });
    }

    return res.status(200).json({
      success: true,
      id: adminResult.data?.id,
      adminSent: true,
      customerSent: !!(customerResult && customerResult.ok),
      simulated: false
    });

  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while sending email'
    });
  }
};

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

// Fallback HTML generators if files are not accessible
function generateOrderHtml(vars) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Order</title></head>
<body style="font-family: sans-serif; background-color: #0f172a; padding: 20px; color: #334155;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; padding: 24px;">
    <h2 style="color: #1a8fe3; margin-top: 0;">Order #${vars.order_number || ''}</h2>
    <p><strong>Customer:</strong> ${vars.customer_name || ''} (${vars.customer_phone || ''})</p>
    <p><strong>Email:</strong> ${vars.customer_email || 'N/A'}</p>
    <p><strong>Delivery Address:</strong> ${vars.delivery_address || ''}</p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
    <h3>Items:</h3>
    <pre style="background: #f8fafc; padding: 12px; border-radius: 6px; font-family: monospace;">${vars.items_summary || ''}</pre>
    <p><strong>Subtotal:</strong> ${vars.subtotal || ''}</p>
    <p><strong>Delivery Fee:</strong> ${vars.delivery_fee || ''}</p>
    <p><strong>Discount:</strong> ${vars.discount || ''}</p>
    <h3 style="color: #1a8fe3;">Total Amount: ${vars.total_amount || ''}</h3>
    <p style="color: #64748b; font-size: 12px;">Placed on: ${vars.order_date || ''} (${vars.order_type || ''})</p>
  </div>
</body>
</html>`;
}

function generateBookingHtml(vars) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Service Booking</title></head>
<body style="font-family: sans-serif; background-color: #0f172a; padding: 20px; color: #334155;">
  <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; padding: 24px;">
    <h2 style="color: #7c3aed; margin-top: 0;">Service Booking #${vars.booking_id || ''}</h2>
    <p><strong>Service:</strong> ${vars.service_name || ''}</p>
    <p><strong>Device Model:</strong> ${vars.device_model || ''}</p>
    <p><strong>Reported Issue:</strong> ${vars.issue_description || ''}</p>
    <p><strong>Time Slot:</strong> ${vars.preferred_slot || ''}</p>
    <p><strong>Estimated Price:</strong> ${vars.estimated_price || ''}</p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
    <p><strong>Customer:</strong> ${vars.customer_name || ''} (${vars.customer_phone || ''})</p>
    <p><strong>Address:</strong> ${vars.customer_address || ''} (Pincode: ${vars.pincode || 'N/A'})</p>
    <p><strong>Distance:</strong> ${vars.distance_km || 'Unknown'}</p>
    <p style="color: #64748b; font-size: 12px;">Requested on: ${vars.booking_date || ''} &bull; Mode: ${vars.fulfillment_mode || ''}</p>
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const defaultTo = process.env.RESEND_TO_EMAIL || 'bhuvaneshwaranaj@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'HiTech <onboarding@resend.dev>';

  try {
    const { type, recipient, subject, templateParams } = req.body || {};
    const toEmail = recipient || defaultTo;

    if (!type || !templateParams) {
      return res.status(400).json({
        error: 'Missing required fields: type and templateParams are required.'
      });
    }

    if (!apiKey) {
      console.warn('RESEND_API_KEY is not defined in environment variables.');
      return res.status(200).json({
        success: false,
        simulated: true,
        message: 'RESEND_API_KEY environment variable is not configured. Email simulated.'
      });
    }

    let htmlContent = '';
    let emailSubject = subject || 'HiTech Notification';

    // Render HTML content based on notification type
    if (type === 'ORDER_NOTIFICATION') {
      emailSubject = subject || `New Order Placed: #${templateParams.order_number || ''} - ${templateParams.customer_name || ''}`;
      try {
        const templatePath = path.join(process.cwd(), 'email-templates', 'order-notification.html');
        if (fs.existsSync(templatePath)) {
          const raw = fs.readFileSync(templatePath, 'utf8');
          htmlContent = interpolateTemplate(raw, templateParams);
        } else {
          htmlContent = generateOrderHtml(templateParams);
        }
      } catch {
        htmlContent = generateOrderHtml(templateParams);
      }
    } else if (type === 'SERVICE_BOOKING') {
      emailSubject = subject || `Service Appointment: ${templateParams.service_name || ''} - ${templateParams.customer_name || ''}`;
      try {
        const templatePath = path.join(process.cwd(), 'email-templates', 'service-booking-notification.html');
        if (fs.existsSync(templatePath)) {
          const raw = fs.readFileSync(templatePath, 'utf8');
          htmlContent = interpolateTemplate(raw, templateParams);
        } else {
          htmlContent = generateBookingHtml(templateParams);
        }
      } catch {
        htmlContent = generateBookingHtml(templateParams);
      }
    } else {
      htmlContent = `<pre>${JSON.stringify(templateParams, null, 2)}</pre>`;
    }

    // Call Resend REST API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: emailSubject,
        html: htmlContent
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.message || 'Failed to dispatch email via Resend'
      });
    }

    return res.status(200).json({
      success: true,
      id: data.id,
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

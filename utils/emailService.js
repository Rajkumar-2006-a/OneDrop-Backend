const emailjs = require('@emailjs/nodejs');
const dotenv = require('dotenv');
dotenv.config();

// Initialize EmailJS with Public and Private Keys
if (process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY) {
  emailjs.init({
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
  });
} else {
  console.warn("EmailJS keys missing in .env. Emails will not be sent.");
}

const sendCampNotification = async (recipients, campDetails) => {
  if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) {
    console.warn("EmailJS Service ID or Template ID missing. Skipping email notification.");
    return;
  }
  if (!recipients || recipients.length === 0) return;

  const formattedDate = new Date(campDetails.camp_date).toLocaleDateString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Helper to pause execution
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Send sequentially to avoid "Too many concurrent requests" from Gmail
  for (const recipientEmail of recipients) {
    const templateParams = {
      to_email: recipientEmail,
      institution_name: campDetails.institution_name,
      camp_date: formattedDate,
      camp_time: campDetails.camp_time || '10:00 AM – 3:00 PM',
      location: campDetails.location,
      contact_person: campDetails.contact_person,
      contact_mobile: campDetails.contact_mobile || 'N/A'
    };

    try {
      const response = await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        process.env.EMAILJS_TEMPLATE_ID,
        templateParams
      );
      console.log('EmailJS sent to ' + recipientEmail + ' | Status: ' + response.status);
    } catch (error) {
      console.error('EmailJS Error sending to ' + recipientEmail + ':', error);
    }

    // Wait 500ms before sending the next email to prevent rate limiting
    await delay(500);
  }
};

module.exports = { sendCampNotification };

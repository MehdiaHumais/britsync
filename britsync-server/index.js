require('dotenv').config();
const dns = require('dns');

// Fix for MongoDB Atlas DNS SRV Resolution on some Windows/VPS environments
// This replaces the system resolver with Google Public DNS for this node process
if (dns.setServers) {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const Project = require('./models/Project');
const Service = require('./models/Service');
const Message = require('./models/Message');
const FAQ = require('./models/FAQ');
const TeamMember = require('./models/TeamMember');
const CoreValue = require('./models/CoreValue');
const HomeExpertise = require('./models/HomeExpertise');
const TimelinePhase = require('./models/TimelinePhase');
const WhyReason = require('./models/WhyReason');
const Stat = require('./models/Stat');
const Client = require('./models/Client');
const Tech = require('./models/Tech');
const SiteSetting = require('./models/SiteSetting');
const Section = require('./models/Section');
const Initiative = require('./models/Initiative');
const Proposal = require('./models/Proposal');

const app = express();
app.set('trust proxy', 1); // Trust nginx reverse proxy — makes req.protocol return 'https'
const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-prod';

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173', // Dev - default vite port
  'http://localhost:5174', // Dev - alternative port
  'http://localhost:5175', // Dev - additional port
  'http://localhost:3000',
  process.env.FRONTEND_URL // Prod
].filter(Boolean);

app.use(cors({
  origin: true, // Temporarily allow all origins for debugging
  credentials: true
}));

// Middleware
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/login', [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  console.log('Login attempt:', req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    const { password } = req.body;

    // Check SiteSetting for stored admin password (hashed)
    // If MongoDB is not connected, fallback immediately to environment variable to avoid 10s timeout
    let adminPassSetting = null;
    if (mongoose.connection.readyState === 1) {
      try {
        adminPassSetting = await SiteSetting.findOne({ key: 'admin_password' }).maxTimeMS(2000);
      } catch (dbErr) {
        console.warn('DB password lookup failed (timeout), falling back to env');
      }
    } else {
      console.warn('MongoDB not connected, falling back to env password');
    }

    if (adminPassSetting && typeof adminPassSetting.value === 'string') {
      const stored = adminPassSetting.value;
      const looksHashed = stored.startsWith('$2');
      if (looksHashed) {
        const match = await bcrypt.compare(password, stored);
        if (!match) {
          console.log('Invalid credentials (db hashed)');
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      } else {
        if (password !== stored) {
          console.log('Invalid credentials (db plaintext)');
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        const hash = await bcrypt.hash(stored, 10);
        adminPassSetting.value = hash;
        await adminPassSetting.save().catch(e => console.error('Failed to migrate password:', e));
        console.log('Migrated plaintext admin password to hashed value in DB');
      }
    } else {
      // Fallback to environment variable (legacy)
      const adminPassword = process.env.ADMIN_PASSWORD || 'britsync1234';
      if (password !== adminPassword) {
        console.log('Invalid credentials (env)');
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    console.log('Login successful, token generated');
    res.json({ token });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Change password endpoint
app.post('/api/auth/change-password', authenticateToken, [
  body('currentPassword').isLength({ min: 1 }).withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  const { currentPassword, newPassword } = req.body;

  try {
    const adminPassSetting = await SiteSetting.findOne({ key: 'admin_password' });
    let verified = false;

    if (adminPassSetting && typeof adminPassSetting.value === 'string') {
      const stored = adminPassSetting.value;
      const looksHashed = stored.startsWith('$2');
      if (looksHashed) {
        verified = await bcrypt.compare(currentPassword, stored);
      } else {
        // legacy plaintext stored in DB
        verified = currentPassword === stored;
      }
    } else {
      // Fallback to env
      const envPass = process.env.ADMIN_PASSWORD || 'admin123';
      verified = currentPassword === envPass;
    }

    if (!verified) return res.status(401).json({ message: 'Current password is incorrect' });

    // Hash and save new password in SiteSetting (upsert)
    const hash = await bcrypt.hash(newPassword, 10);
    if (adminPassSetting) {
      adminPassSetting.value = hash;
      await adminPassSetting.save();
    } else {
      await new SiteSetting({ key: 'admin_password', value: hash }).save();
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer Configuration with Safety
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + sanitized);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Images, PDFs, and Word documents are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Admin: Upload Strategic Asset
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ 
    message: 'File uploaded successfully', 
    url: fileUrl,
    filename: req.file.filename 
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true
})
  .then(() => {
    console.log('MongoDB Connected successfully');
    console.log('Database:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    console.error('Make sure MongoDB is running locally or update MONGODB_URI in .env');
    // Don't exit, let the server run without database for testing
  });

// --- WHATSAPP HELPER ---
const sendWhatsAppNotification = async (phoneNumber, userName, viewLink) => {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || WHATSAPP_ACCESS_TOKEN === 'PLACEHOLDER') {
    console.log('WhatsApp credentials missing or placeholders. Skipping WhatsApp send.');
    return;
  }

  // Sanitize phone number (remove +, spaces, etc. - Needs to be in international format e.g. 447123456789)
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: 'proposal_notification', // This template needs to be created in Meta Business Suite
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: userName },
                { type: 'text', text: viewLink }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('WhatsApp message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('WhatsApp send failed:', error.response ? error.response.data : error.message);
    // If template is not set up, try sending a direct text (only works if user messaged within 24h)
    try {
      console.log('Attempting direct text backup...');
      await axios.post(
        `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: {
            body: `Hello ${userName}, your project proposal from BritSync is ready! View and sign it here: ${viewLink}`
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Direct text WhatsApp sent.');
    } catch (directErr) {
      console.error('Direct WhatsApp backup also failed.');
    }
  }
};

// --- GENERIC CRUD HELPER ---
const createCrudRoutes = (model, routeName) => {
  app.get(`/api/${routeName}`, async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) return res.json([]);
      res.json(await model.find().sort({ order: 1, createdAt: 1 }));
    }
    catch (err) { res.json([]); }
  });
  app.post(`/api/${routeName}`, authenticateToken, [
    body('title').optional().isLength({ min: 1 }).withMessage('Title required'),
    body('name').optional().isLength({ min: 1 }).withMessage('Name required')
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try { res.status(201).json(await new model(req.body).save()); }
    catch (err) { res.status(400).json({ message: err.message }); }
  });
  app.put(`/api/${routeName}/:id`, authenticateToken, [
    body('title').optional().isLength({ min: 1 }).withMessage('Title required'),
    body('name').optional().isLength({ min: 1 }).withMessage('Name required')
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    try { res.json(await model.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
    catch (err) { res.status(400).json({ message: err.message }); }
  });
  app.delete(`/api/${routeName}/:id`, authenticateToken, async (req, res) => {
    try { await model.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
    catch (err) { res.status(500).json({ message: err.message }); }
  });
};

// --- ROUTES ---

// Specialized Services (Project/Services existing)
app.get('/api/services', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    res.json(await Service.find().sort({ order: 1, createdAt: 1 }));
  }
  catch (err) { res.json([]); }
});

app.post('/api/services', authenticateToken, [
  body('title').isLength({ min: 1 }).withMessage('Title required'),
  body('description').optional().isLength({ min: 1 }).withMessage('Description required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    let desiredOrder = typeof req.body.order !== 'undefined' ? parseInt(req.body.order, 10) : null;
    if (desiredOrder !== null && (isNaN(desiredOrder) || desiredOrder < 1)) desiredOrder = 1;

    if (desiredOrder !== null) {
      // Shift existing services at or after desiredOrder forward
      await Service.updateMany({ order: { $gte: desiredOrder } }, { $inc: { order: 1 } });
    } else {
      // Assign to end (1-based)
      const max = await Service.findOne().sort({ order: -1 }).select('order').lean();
      desiredOrder = (max && typeof max.order === 'number') ? (max.order + 1) : 1;
    }

    const payload = { ...req.body, order: desiredOrder };
    const created = await new Service(payload).save();
    // Ensure all orders are sequential (gapless)
    await resequenceServiceOrders();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


app.put('/api/services/:id', authenticateToken, [
  body('title').optional().isLength({ min: 1 }).withMessage('Title required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    if (typeof req.body.order !== 'undefined') {
      let desired = parseInt(req.body.order, 10);
      if (isNaN(desired) || desired < 1) desired = 1;
      const old = service.order || 0;

      if (desired !== old) {
        if (desired < old) {
          // Move item up: increment others in [desired, old-1]
          await Service.updateMany({ _id: { $ne: service._id }, order: { $gte: desired, $lt: old } }, { $inc: { order: 1 } });
        } else {
          // Move item down: decrement others in [old+1, desired]
          await Service.updateMany({ _id: { $ne: service._id }, order: { $lte: desired, $gt: old } }, { $inc: { order: -1 } });
        }
      }

      // Apply updates including new order
      const updatePayload = { ...req.body, order: desired };
      const updated = await Service.findByIdAndUpdate(req.params.id, updatePayload, { new: true });
      // Ensure all orders are sequential (gapless)
      await resequenceServiceOrders();
      return res.json(updated);
    }

    // No order change — normal update
    const updated = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Helper to resequence all service orders to be 1,2,3,...
async function resequenceServiceOrders() {
  const services = await Service.find().sort({ order: 1, createdAt: 1 });
  for (let i = 0; i < services.length; i++) {
    if (services[i].order !== i + 1) {
      services[i].order = i + 1;
      await services[i].save();
    }
  }
}

app.delete('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Service.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Service not found' });
    // After deletion, shift all orders after the deleted one backward
    await Service.updateMany({ order: { $gt: deleted.order } }, { $inc: { order: -1 } });
    // Ensure all orders are sequential (gapless)
    await resequenceServiceOrders();
    res.json({ message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/projects', async (req, res) => {
  console.log('GET /api/projects requested');
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected, returning empty projects');
      return res.json([]);
    }
    const { category } = req.query;
    let query = {};
    if (category && category !== 'all') query.category = { $regex: category, $options: 'i' };
    const projects = await Project.find(query).sort({ id: 1 });
    console.log('Found projects:', projects.length);
    res.json(projects);
  } catch (err) {
    console.error('Error in /api/projects:', err);
    res.json([]); // Still return empty instead of 500 for better UI stability
  }
});
app.post('/api/projects', authenticateToken, [
  body('title').isLength({ min: 1 }).withMessage('Title required'),
  body('category').isLength({ min: 1 }).withMessage('Category required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try { res.status(201).json(await new Project(req.body).save()); }
  catch (err) { res.status(400).json({ message: err.message }); }
});
app.put('/api/projects/:id', authenticateToken, [
  body('title').optional().isLength({ min: 1 }).withMessage('Title required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try { res.json(await Project.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (err) { res.status(400).json({ message: err.message }); }
});
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try { await Project.findByIdAndDelete(req.params.id); res.json({ message: 'Project deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// Image Upload Endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url });
});

// New CRUD Routes
createCrudRoutes(FAQ, 'faqs');
createCrudRoutes(TeamMember, 'team');
createCrudRoutes(CoreValue, 'values');
createCrudRoutes(HomeExpertise, 'expertise');
createCrudRoutes(TimelinePhase, 'phases');
createCrudRoutes(WhyReason, 'why-reasons');
createCrudRoutes(Stat, 'stats');
createCrudRoutes(Client, 'clients');
createCrudRoutes(Tech, 'tech');
createCrudRoutes(Section, 'sections');
const Category = require('./models/Category');
// create crud routes
createCrudRoutes(Category, 'categories');
createCrudRoutes(Initiative, 'initiatives');
// Specific SiteSetting routes for KV pairing
app.get('/api/settings', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json({});
    const settings = await SiteSetting.find();
    const settingsMap = {};
    settings.forEach(s => settingsMap[s.key] = s.value);
    res.json(settingsMap);
  } catch (err) { res.json({}); }
});
app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    const updated = await SiteSetting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    res.json(updated);
  } catch (err) { res.status(400).json({ message: err.message }); }
});


// Configure Nodemailer transporter (reusable)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  secure: true,
  auth: {
    user: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || ''
  },
  tls: {
    // Do not fail on invalid certificates (useful for some dev/windows environments)
    rejectUnauthorized: false
  }
});

// Save a new message (contact form), send to admin, and send auto-reply to user
app.post('/api/messages', async (req, res) => {
  try {
    // Extract fields from request body
    const { user_name, email, phone_number, service_id, message } = req.body;

    // Validation
    if (!user_name || !email || !phone_number || !service_id || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Fetch service details for email
    const service = await Service.findById(service_id);
    const serviceName = service ? service.title : 'Unknown Service';

    // Save to database
    const savedMessage = await new Message({
      userName: user_name,
      email,
      phoneNumber: phone_number,
      serviceId: service_id,
      message
    }).save();

    // Send email to admin - Professional Admin-Friendly Format
    const adminEmail = {
      from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
      to: process.env.GMAIL_RECEIVER || 'britsyncuk@gmail.com',
      subject: `📧 New Contact Form Message - ${user_name}`,
      html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #800020 0%, #00BFFF 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
                        .content { background: #ffffff; border: 1px solid #e0e0e0; border-top: none; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-grid { display: grid; grid-template-columns: 120px 1fr; gap: 15px; margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
                        .info-label { font-weight: 600; color: #666; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
                        .info-value { color: #1a1a1a; font-size: 15px; }
                        .message-box { background: #ffffff; border-left: 4px solid #00BFFF; padding: 20px; margin: 20px 0; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                        .message-text { white-space: pre-wrap; font-size: 15px; line-height: 1.8; color: #333; margin: 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px; }
                        .action-btn { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #00BFFF; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
                        .badge { display: inline-block; padding: 4px 12px; background: #00BFFF; color: white; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📧 New Contact Form Submission</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">BritSync Contact Form</p>
                        </div>
                        <div class="content">
                            <div class="info-grid">
                                <div class="info-label">👤 Name:</div>
                                <div class="info-value"><strong>${user_name}</strong></div>
                                
                                <div class="info-label">📧 Email:</div>
                                <div class="info-value">
                                    <a href="mailto:${email}" style="color: #00BFFF; text-decoration: none;">${email}</a>
                                </div>
                                
                                <div class="info-label">📞 Phone:</div>
                                <div class="info-value">
                                    <a href="tel:${phone_number}" style="color: #00BFFF; text-decoration: none;">${phone_number}</a>
                                </div>
                                
                                <div class="info-label">🎯 Service:</div>
                                <div class="info-value"><strong>${serviceName}</strong></div>
                                
                                <div class="info-label">🕐 Received:</div>
                                <div class="info-value">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</div>
                            </div>
                            
                            <div style="margin: 25px 0;">
                                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                    <h3 style="margin: 0; color: #1a1a1a; font-size: 18px;">Message Content</h3>
                                    <span class="badge">NEW</span>
                                </div>
                                <div class="message-box">
                                    <p class="message-text">${message}</p>
                                </div>
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL || 'britsyncai.com'}/admin/dashboard" class="action-btn">View in Admin Panel →</a>
                            </div>
                            
                            <div class="footer">
                                <p>This is an automated notification from BritSync Contact Form System.</p>
                                <p style="margin: 5px 0 0 0;">Please respond to the user within 24-48 hours.</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
    };

    // Auto-reply email to user
    const autoReplyEmail = {
      from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
      to: email,
      subject: 'Thank You for Contacting BritSync - We\'ll Be In Touch Soon!',
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <div style="background: linear-gradient(135deg, #800020 0%, #00BFFF 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">Thank You, ${user_name}!</h1>
                    </div>
                    <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                        <p style="font-size: 16px; line-height: 1.6; color: #333;">
                            We've successfully received your message and appreciate you taking the time to reach out to us at <strong>BritSync</strong>.
                        </p>
                        <p style="font-size: 16px; line-height: 1.6; color: #333;">
                            Our team is currently reviewing your inquiry about <strong>${serviceName}</strong> and will get back to you within <strong>24-48 hours</strong>. We're committed to providing you with the best possible service and look forward to discussing how we can help bring your vision to life.
                        </p>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #00BFFF;">
                            <p style="margin: 0; font-size: 14px; color: #666;">
                                <strong>What's Next?</strong><br/>
                                While you wait, feel free to explore our portfolio and learn more about the innovative solutions we've delivered for our clients. If you have any urgent questions, don't hesitate to reach out directly.
                            </p>
                        </div>
                        <p style="font-size: 16px; line-height: 1.6; color: #333;">
                            Best regards,<br/>
                            <strong>The BritSync Team</strong><br/>
                            <span style="color: #00BFFF;">Crafting Digital Realities</span>
                        </p>
                    </div>
                    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                        <p style="margin: 0;">This is an automated confirmation email. Please do not reply directly to this message.</p>
                        <p style="margin: 10px 0 0 0;">© ${new Date().getFullYear()} BritSync. All rights reserved.</p>
                    </div>
                </div>
            `
    };

    // Send both emails (don't fail if email fails, message is already saved)
    Promise.all([
      emailTransporter.sendMail(adminEmail).catch(emailErr => {
        console.error('Failed to send admin email:', emailErr);
      }),
      emailTransporter.sendMail(autoReplyEmail).catch(emailErr => {
        console.error('Failed to send auto-reply email:', emailErr);
      })
    ]).catch(err => {
      console.error('Email sending error:', err);
      // Don't throw - message is already saved to DB
    });

    res.status(201).json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('Error in /api/messages:', err);
    // Database or validation errors
    if (err.name === 'ValidationError') {
      res.status(400).json({ message: err.message });
    } else {
      res.status(500).json({ message: 'Error sending message. Please try again.' });
    }
  }
});

// Admin: Get messages with search, filter, pagination
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    // Query params: search, filter, page, limit
    const { search = '', filter = '', page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }
    if (filter === 'unread') query.isRead = false;
    if (filter === 'read') query.isRead = true;
    if (filter === 'replied') query.replied = true;
    if (filter === 'not-replied') query.replied = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .populate('serviceId', 'title') // Populate service details
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    res.json({ messages, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Mark a message as read
app.patch('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Reply to a message
app.patch('/api/messages/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { adminReply } = req.body;
    if (!adminReply) return res.status(400).json({ message: 'Reply text required' });
    const msg = await Message.findByIdAndUpdate(
      req.params.id,
      { adminReply, replied: true, replyAt: new Date(), isRead: true },
      { new: true }
    );
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    // TODO: Optionally send email to userEmail here
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Delete a message
app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    const msg = await Message.findByIdAndDelete(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Mark all as read
app.patch('/api/messages/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await Message.updateMany({ isRead: false }, { isRead: true });
    res.json({ message: 'All messages marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PROPOSAL ROUTES ---

// Submit a new proposal (Public)
app.post('/api/proposals', async (req, res) => {
  console.log('--- PROPOSAL SUBMISSION START ---');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  try {
    const { userName, email, phoneNumber, projectDescription, startDate, durationType, durationValue, deliverables } = req.body;

    // Manual validation check before Mongoose
    if (!userName || !email || !phoneNumber || !projectDescription || !startDate || !durationType || !deliverables) {
      console.warn('Missing required proposal fields');
      return res.status(400).json({ message: 'Please fill in all required fields marked with *' });
    }

    const proposal = new Proposal({
      userName,
      email,
      phoneNumber,
      projectDescription,
      startDate,
      duration: {
        type: durationType,
        value: durationValue
      },
      deliverables
    });

    console.log('Attempting to save proposal to DB...');
    const savedProposal = await proposal.save();
    console.log('Proposal saved successfully:', savedProposal._id);

    // --- BACKGROUND TASKS: Email ---
    Promise.resolve().then(async () => {
      try {
        const adminEmail = {
          from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
          to: process.env.GMAIL_RECEIVER || 'britsyncuk@gmail.com',
          subject: `📜 New Project Proposal - ${userName}`,
          html: `<h3>New Proposal Received</h3>
                     <p><strong>Name:</strong> ${userName}</p>
                     <p><strong>Email:</strong> ${email}</p>
                     <p><strong>Project:</strong> ${projectDescription}</p>
                     <p><strong>Timeline:</strong> ${durationType} (${durationValue || 'N/A'})</p>
                     <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/dashboard">View in Dashboard</a>`
        };
        await emailTransporter.sendMail(adminEmail);
        console.log('✅ Admin proposal notification email sent');
      } catch (emailErr) {
        console.error('❌ Admin proposal notify background task failed:', emailErr.message);
      }
    });

    res.status(201).json(savedProposal);
  } catch (err) {
    console.error('CRITICAL ERROR in /api/proposals:', err);
    res.status(400).json({
      message: err.message,
      name: err.name,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Get all proposals with search and filtering (Admin)
app.get('/api/proposals', authenticateToken, async (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Proposal.countDocuments(query);
    const proposals = await Proposal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ proposals, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single proposal (Public/Admin)
app.get('/api/proposals/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Enrichment - Update professional details of a proposal
app.patch('/api/proposals/:id', authenticateToken, async (req, res) => {
  try {
    const updateData = {
      executiveSummary: req.body.executiveSummary,
      objectives: req.body.objectives,
      scopeModules: req.body.scopeModules,
      executionModels: req.body.executionModels,
      timelinePhases: req.body.timelinePhases,
      deliverables: req.body.deliverables,
      projectDescription: req.body.projectDescription,
      detailedProposalUrl: req.body.detailedProposalUrl, // ENSURE THIS IS EXPLICITLY ACCESSED
      pricingOptions: req.body.pricingOptions,
      discount: req.body.discount
    };

    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    res.json(proposal);
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Send proposal to user (Admin)
app.post('/api/proposals/:id/send', authenticateToken, async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const viewLink = `${frontendUrl}/proposal/${proposal._id}`;
    
    const isRevision = !!proposal.sentAt;
    const emailSubject = isRevision ? 'Revised Project Proposal from BritSync' : 'Your Project Proposal from BritSync';
    const emailHeader = isRevision ? 'Revised Project Proposal Confirmation' : 'Project Proposal Confirmation';
    const emailIntro = isRevision 
      ? 'We have updated your project proposal with the revised requirements.' 
      : 'We have reviewed your project requirements and prepared a formal proposal for you.';

    // 1. Send Email
    try {
      const userEmail = {
        from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
        to: proposal.email,
        subject: emailSubject,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
              <h2 style="color: #800020;">${emailHeader}</h2>
              <p>Hello ${proposal.userName},</p>
              <p>${emailIntro}</p>
              <p>Please click the link below to view the updated proposal and sign it digitally to proceed:</p>
              <div style="margin: 30px 0; display: flex; gap: 15px;">
                <a href="${viewLink}" style="background: #00BFFF; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Strategic Proposal</a>
                ${proposal.detailedProposalUrl ? `
                <a href="${proposal.detailedProposalUrl}" style="background: #1A2A40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Detailed PDF</a>
                ` : ''}
              </div>
              <p>If you have any questions, feel free to reply to this email.</p>
              <br/>
              <p>Best regards,<br/><strong>BritSync Team</strong></p>
            </div>
          `
      };
      await emailTransporter.sendMail(userEmail);
      console.log(`✅ Proposal sent to client: ${proposal.email} (Revision: ${isRevision})`);
    } catch (emailErr) {
      console.error('❌ CRITICAL EMAIL FAILURE Details:');
      console.error('- Message:', emailErr.message);
      console.error('- Code:', emailErr.code);
      if (emailErr.response) console.error('- Response:', emailErr.response);
      // THROW the error so the outer catch block handles it and returns a 500 to the admin panel
      throw new Error(`Email failed: ${emailErr.message}`);
    }

    // 2. WhatsApp Notification
    await sendWhatsAppNotification(proposal.phoneNumber, proposal.userName, viewLink);

    // Clear previous signature and set status to sent
    proposal.signature = undefined;
    proposal.signedAt = undefined;
    proposal.status = 'sent';
    proposal.sentAt = new Date();
    await proposal.save();

    res.json({ message: 'Proposal sent successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/proposals/:id/accept', async (req, res) => {
  console.log(`📝 RECV: Signature for Proposal ID: ${req.params.id}`);
  try {
    const { signature } = req.body;
    console.log(`📦 Signature Payload Size: ${signature?.length || 0} characters`);
    if (!signature) return res.status(400).json({ message: 'Signature is required' });

    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { signature, status: 'signed', signedAt: new Date() },
      { new: true }
    );

    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });

    res.json(proposal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete proposal (Admin)
app.delete('/api/proposals/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndDelete(req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    res.json({ message: 'Proposal record purged successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start Server
// Serve frontend if built into `public/` (optional)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// --- BOT CHAT AGENT ROUTE (DEPRECATED - Moved to n8n) ---
// const { generateChatResponse, clearSession, getSessionInfo } = require('./chatAgent');
// const { initPostgres } = require('./knowledgeBase');

// Initialize PostgreSQL connection for articles
// initPostgres();

/*
app.post('/api/bot/chat', async (req, res) => {
  try {
    const { chatInput, sessionId, action } = req.body;

    // Handle special actions
    if (action === 'clearSession' && sessionId) {
      clearSession(sessionId);
      return res.json({ success: true, message: 'Session cleared' });
    }

    if (action === 'getSessionInfo' && sessionId) {
      const info = getSessionInfo(sessionId);
      return res.json({ success: true, ...info });
    }

    // Generate AI response using our code-based agent
    const result = await generateChatResponse(chatInput, sessionId);

    if (result.success) {
      res.json({
        output: result.response,
        success: true,
        hasArticles: result.hasArticles,
        articlesCount: result.articlesCount
      });
    } else {
      res.json({
        output: result.response,
        success: false
      });
    }
  } catch (err) {
    console.error('Chat Agent Error:', err);
    res.status(500).json({
      message: 'Error processing your message. Please try again.',
      output: "I'm having a momentary issue. Please try again! 🔄"
    });
  }
});
*/


// --- BRITSYNC DOCU ROUTES ---
const DocuDocument = require('./models/DocuDocument');
const DocuAuditLog = require('./models/DocuAuditLog');
const { compileFinalPdf, getFilePathFromUrl } = require('./services/docuService');
const crypto = require('crypto');

// Dedicated PDF-only multer configuration for BritSync Docu
const docuUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, 'docu-' + Date.now() + '-' + sanitized);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Admin: Upload PDF
app.post('/api/britsync-docu/upload', authenticateToken, docuUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname });
});

// Admin: Create new document draft with fields
app.post('/api/britsync-docu/admin/documents', authenticateToken, async (req, res) => {
  try {
    const { document_name, original_file_url, fields } = req.body;
    
    // Default expiry: 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const token = crypto.randomBytes(32).toString('hex');
    
    const doc = new DocuDocument({
      document_name,
      original_file_url,
      secure_token: token,
      status: 'draft',
      expires_at: expiresAt,
      fields: fields || []
    });
    
    const saved = await doc.save();
    
    // Create upload audit log
    await new DocuAuditLog({
      document_id: saved._id,
      event_type: 'DOCUMENT_UPLOADED',
      metadata: { document_name }
    }).save();
    
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Update document details/fields
app.patch('/api/britsync-docu/admin/documents/:id', authenticateToken, async (req, res) => {
  try {
    const { fields, document_name, expires_at } = req.body;
    const doc = await DocuDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
    if (fields) doc.fields = fields;
    if (document_name) doc.document_name = document_name;
    if (expires_at) doc.expires_at = new Date(expires_at);
    
    const saved = await doc.save();
    
    await new DocuAuditLog({
      document_id: saved._id,
      event_type: 'FIELDS_SAVED',
      metadata: { fields_count: fields ? fields.length : 0 }
    }).save();
    
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Retrieve all documents
app.get('/api/britsync-docu/admin/documents', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'archived' };
    }
    
    const docs = await DocuDocument.find(query).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Retrieve specific document audit logs
app.get('/api/britsync-docu/admin/documents/:id/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await DocuAuditLog.find({ document_id: req.params.id }).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Send secure document signing link to recipient
app.post('/api/britsync-docu/admin/documents/:id/send', authenticateToken, async (req, res) => {
  try {
    const { recipient_email, expires_at, email_message } = req.body;
    const doc = await DocuDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
    doc.recipient_email = recipient_email;
    if (expires_at) doc.expires_at = new Date(expires_at);
    doc.status = 'sent';
    doc.sent_at = new Date();
    
    const saved = await doc.save();
    
    // Resolve frontend base path (Using FRONTEND_URL environment variable or localhost fallback)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const signingLink = `${frontendUrl}/britsync-docu/${saved.secure_token}`;
    
    const expiryFormatted = new Date(doc.expires_at).toLocaleDateString('en-GB');
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <h2 style="color: #800020; text-align: center; font-size: 24px; margin-bottom: 20px;">Document Signature Request</h2>
        <p style="font-size: 16px; line-height: 1.6;">Hello,</p>
        <p style="font-size: 16px; line-height: 1.6;">BritSync has sent you a document to review, complete, and sign.</p>
        ${email_message ? `<div style="background-color: #f8f9fa; border-left: 4px solid #00BFFF; padding: 15px; margin: 20px 0; font-style: italic; border-radius: 4px; color: #555;">"${email_message}"</div>` : ''}
        <div style="text-align: center; margin: 35px 0;">
          <a href="${signingLink}" style="background-color: #00BFFF; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0, 191, 255, 0.25);">Open Document</a>
        </div>
        <p style="font-size: 13px; color: #777; text-align: center; margin-top: 25px;">This secure link will expire on <strong>${expiryFormatted}</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="font-size: 11px; color: #999; text-align: center;">This is an automated notification from BritSync Docu. Please do not reply directly to this mail.</p>
      </div>
    `;
    
    await emailTransporter.sendMail({
      from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
      to: recipient_email,
      subject: 'Document Signature Request from BritSync',
      html: emailHtml
    });
    
    await new DocuAuditLog({
      document_id: saved._id,
      recipient_email,
      event_type: 'DOCUMENT_SENT',
      metadata: { expires_at: doc.expires_at }
    }).save();
    
    await new DocuAuditLog({
      document_id: saved._id,
      recipient_email,
      event_type: 'EMAIL_SENT',
      metadata: { to: recipient_email }
    }).save();
    
    res.json(saved);
  } catch (err) {
    console.error('Send Docu Link Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Admin: Resend secure document signing link (updates expiry optionally)
app.post('/api/britsync-docu/admin/documents/:id/resend', authenticateToken, async (req, res) => {
  try {
    const { expires_at } = req.body;
    const doc = await DocuDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (!doc.recipient_email) return res.status(400).json({ message: 'No recipient email configured for this document' });
    
    if (expires_at) doc.expires_at = new Date(expires_at);
    doc.status = 'sent';
    doc.sent_at = new Date();
    
    const saved = await doc.save();
    
    // Resolve frontend base path (Using FRONTEND_URL environment variable or localhost fallback)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const signingLink = `${frontendUrl}/britsync-docu/${saved.secure_token}`;
    
    const expiryFormatted = new Date(doc.expires_at).toLocaleDateString('en-GB');
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px;">
        <h2 style="color: #800020; text-align: center; font-size: 24px;">Reminder: Document Signature Request</h2>
        <p style="font-size: 16px; line-height: 1.6;">Hello,</p>
        <p style="font-size: 16px; line-height: 1.6;">This is a reminder that you have a document waiting to be signed from BritSync.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${signingLink}" style="background-color: #00BFFF; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Open Document</a>
        </div>
        <p style="font-size: 13px; color: #777; text-align: center;">This link will expire on <strong>${expiryFormatted}</strong>.</p>
      </div>
    `;
    
    await emailTransporter.sendMail({
      from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
      to: doc.recipient_email,
      subject: 'Reminder: Document Signature Request from BritSync',
      html: emailHtml
    });
    
    await new DocuAuditLog({
      document_id: saved._id,
      recipient_email: doc.recipient_email,
      event_type: 'LINK_RESENT',
      metadata: { expires_at: doc.expires_at }
    }).save();
    
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Archive document
app.post('/api/britsync-docu/admin/documents/:id/archive', authenticateToken, async (req, res) => {
  try {
    const doc = await DocuDocument.findByIdAndUpdate(
      req.params.id,
      { status: 'archived', archived_at: new Date() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
    await new DocuAuditLog({
      document_id: doc._id,
      event_type: 'DOCUMENT_ARCHIVED'
    }).save();
    
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Unarchive/Restore document
app.post('/api/britsync-docu/admin/documents/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const doc = await DocuDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    
    // Determine target restore status based on document properties
    let targetStatus = 'draft';
    if (doc.final_file_url || doc.completed_at) {
      targetStatus = 'completed';
    } else if (doc.recipient_email) {
      if (doc.viewed_at) {
        targetStatus = 'viewed';
      } else {
        targetStatus = 'sent';
      }
    }
    
    // Check if expired
    if (doc.expires_at && new Date(doc.expires_at) < new Date() && targetStatus !== 'completed') {
      targetStatus = 'expired';
    }
    
    doc.status = targetStatus;
    doc.archived_at = undefined;
    const saved = await doc.save();
    
    await new DocuAuditLog({
      document_id: doc._id,
      event_type: 'DOCUMENT_UNARCHIVED'
    }).save();
    
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Download final signed PDF
app.get('/api/britsync-docu/admin/documents/:id/download', authenticateToken, async (req, res) => {
  try {
    const doc = await DocuDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.status !== 'completed' || !doc.final_file_url) {
      return res.status(400).json({ message: 'Signed document is not compiled yet.' });
    }
    
    await new DocuAuditLog({
      document_id: doc._id,
      recipient_email: doc.recipient_email,
      event_type: 'SIGNED_PDF_DOWNLOADED',
      ip_address: req.ip || req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent'],
      metadata: { downloaded_by: 'admin' }
    }).save();
    
    res.redirect(doc.final_file_url);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recipient: Get document metadata by secure token
app.get('/api/britsync-docu/sign/:token', async (req, res) => {
  try {
    const doc = await DocuDocument.findOne({ secure_token: req.params.token });
    if (!doc) return res.status(404).json({ message: 'Invalid secure token' });
    
    const now = new Date();
    if (doc.status !== 'completed' && doc.expires_at < now) {
      doc.status = 'expired';
      await doc.save();
      
      await new DocuAuditLog({
        document_id: doc._id,
        event_type: 'DOCUMENT_EXPIRED',
        ip_address: req.ip || req.headers['x-forwarded-for'],
        user_agent: req.headers['user-agent']
      }).save();
      
      return res.status(400).json({ message: 'This document signing link has expired. Please contact BritSync.' });
    }
    
    // Set status to viewed on first load
    if (doc.status === 'sent') {
      doc.status = 'viewed';
      doc.viewed_at = new Date();
      await doc.save();
      
      await new DocuAuditLog({
        document_id: doc._id,
        recipient_email: doc.recipient_email,
        event_type: 'DOCUMENT_VIEWED',
        ip_address: req.ip || req.headers['x-forwarded-for'],
        user_agent: req.headers['user-agent']
      }).save();
    }
    
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recipient: Submit final values and sign document
app.post('/api/britsync-docu/sign/:token/complete', async (req, res) => {
  try {
    const { fields } = req.body;
    const doc = await DocuDocument.findOne({ secure_token: req.params.token });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.status === 'completed') return res.status(400).json({ message: 'Document is already completed' });
    
    // Check expiry
    const now = new Date();
    if (doc.expires_at < now) {
      return res.status(400).json({ message: 'Document link has expired.' });
    }
    
    // Update fields and validate required ones
    for (const f of fields) {
      const docField = doc.fields.id(f._id);
      if (docField) {
        if (docField.assigned_to === 'user') {
          if (docField.field_type === 'text') {
            if (docField.required && (!f.value || !f.value.trim())) {
              return res.status(400).json({ message: `Field "${docField.label || 'Text'}" is required` });
            }
            docField.value = f.value;
          } else if (docField.field_type === 'user_signature') {
            if (docField.required && !f.signature_data) {
              return res.status(400).json({ message: `Signature is required` });
            }
            docField.signature_data = f.signature_data;
          }
        }
      }
    }
    
    // Log text details input
    await new DocuAuditLog({
      document_id: doc._id,
      event_type: 'TEXT_FIELD_FILLED',
      metadata: { fields_updated: fields.filter(f => f.field_type === 'text').length }
    }).save();

    // Log user signature addition
    if (fields.some(f => f.field_type === 'user_signature' && f.signature_data)) {
      await new DocuAuditLog({
        document_id: doc._id,
        event_type: 'USER_SIGNATURE_ADDED'
      }).save();
    }

    // Compile the final flat PDF
    const finalFilename = await compileFinalPdf(doc);
    const finalFileUrl = `${req.protocol}://${req.get('host')}/uploads/${finalFilename}`;
    
    doc.final_file_url = finalFileUrl;
    doc.status = 'completed';
    doc.completed_at = new Date();
    await doc.save();
    
    await new DocuAuditLog({
      document_id: doc._id,
      recipient_email: doc.recipient_email,
      event_type: 'DOCUMENT_COMPLETED',
      ip_address: req.ip || req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent']
    }).save();
    
    await new DocuAuditLog({
      document_id: doc._id,
      event_type: 'SIGNED_PDF_GENERATED',
      metadata: { final_file_url: finalFileUrl }
    }).save();
    
    res.json(doc);
  } catch (err) {
    console.error('Docu complete failed:', err);
    res.status(500).json({ message: err.message });
  }
});

// Recipient: Secure download link
app.get('/api/britsync-docu/sign/:token/download', async (req, res) => {
  try {
    const doc = await DocuDocument.findOne({ secure_token: req.params.token });
    if (!doc) return res.status(404).json({ message: 'Invalid token' });
    if (doc.status !== 'completed' || !doc.final_file_url) {
      return res.status(400).json({ message: 'Signed document is not completed yet.' });
    }
    
    await new DocuAuditLog({
      document_id: doc._id,
      recipient_email: doc.recipient_email,
      event_type: 'SIGNED_PDF_DOWNLOADED',
      ip_address: req.ip || req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent'],
      metadata: { downloaded_by: 'recipient' }
    }).save();
    
    res.redirect(doc.final_file_url);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mount new BritSync Docu Standalone Router
const docuRouter = require('./routes/docu');
app.use('/api/docu', docuRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


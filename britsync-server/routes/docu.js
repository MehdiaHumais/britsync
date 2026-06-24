const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

// Models
const DocuUser = require('../models/DocuUser');
const DocuWorkspace = require('../models/DocuWorkspace');
const DocuWorkspaceMember = require('../models/DocuWorkspaceMember');
const DocuDocumentNew = require('../models/DocuDocumentNew');
const DocuTemplate = require('../models/DocuTemplate');
const DocuContact = require('../models/DocuContact');
const DocuAuditLogNew = require('../models/DocuAuditLogNew');
const DocuNotification = require('../models/DocuNotification');
const DocuReminder = require('../models/DocuReminder');

// Services
const { compileFinalPdfNew, getFilePathFromUrl, calculateHash, generateAuditReportPdf } = require('../services/docuServiceNew');

// SMTP email config
const nodemailer = require('nodemailer');
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'fukhalfliscbbuoa'
    }
});

const sanitizeTextForPdf = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2014\u2013]/g, '-')
        .replace(/\u00a0/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, '');
};

// Middleware: Authenticate Docu JWT
const authenticateDocuToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authorization token required' });

    jwt.verify(token, process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025', (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired authorization token' });
        req.user = decoded; // { id, email, workspaceId }
        next();
    });
};

const fetchUserRole = async (req, res, next) => {
    try {
        const member = await DocuWorkspaceMember.findOne({
            workspace_id: req.user.workspaceId,
            user_id: req.user.id,
            status: 'joined'
        });
        if (!member) {
            return res.status(403).json({ message: 'User is not a member of this workspace' });
        }
        req.user.role = member.role; // 'owner', 'admin', 'member', 'viewer'
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const requireCreateSendPermission = [authenticateDocuToken, fetchUserRole, (req, res, next) => {
    if (req.user.role === 'viewer') {
        return res.status(403).json({ message: 'Permission denied. Viewer role cannot perform this action.' });
    }
    next();
}];

const requireAdminPermission = [authenticateDocuToken, fetchUserRole, (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Permission denied. Only administrator or owner can perform this action.' });
    }
    next();
}];

// Multer setup
const docuUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
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
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const parseUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Helper: Log audit event
const logAuditEvent = async ({ workspace_id, document_id, recipient_id, user_id, event_type, ip_address, user_agent, metadata }) => {
    try {
        await new DocuAuditLogNew({
            workspace_id,
            document_id,
            recipient_id,
            user_id,
            event_type,
            ip_address,
            user_agent,
            metadata_json: JSON.stringify(metadata || {})
        }).save();
    } catch (err) {
        console.error('Audit logging failed:', err);
    }
};

// Helper: Create notification
const createNotification = async ({ workspace_id, user_id, document_id, type, title, message }) => {
    try {
        await new DocuNotification({
            workspace_id,
            user_id,
            document_id,
            type,
            title,
            message
        }).save();
    } catch (err) {
        console.error('Notification creation failed:', err);
    }
};

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

router.post('/auth/signup', async (req, res) => {
    try {
        const { full_name, email, password, workspace_name } = req.body;
        if (!full_name || !email || !password) {
            return res.status(400).json({ message: 'Full name, email, and password are required' });
        }

        let user = await DocuUser.findOne({ email });
        let isInvitedNewUser = false;

        if (user) {
            const hasInvitedMembership = await DocuWorkspaceMember.exists({ user_id: user._id, status: 'invited' });
            if (!user.email_verified && hasInvitedMembership) {
                isInvitedNewUser = true;
            } else {
                return res.status(400).json({ message: 'User with this email already exists' });
            }
        }

        let savedUser;
        if (isInvitedNewUser) {
            const password_hash = await bcrypt.hash(password, 10);
            user.full_name = full_name;
            user.password_hash = password_hash;
            user.email_verified = true;
            savedUser = await user.save();

            // Mark invited memberships as joined
            await DocuWorkspaceMember.updateMany(
                { user_id: user._id, status: 'invited' },
                { status: 'joined' }
            );
        } else {
            const password_hash = await bcrypt.hash(password, 10);
            user = new DocuUser({
                full_name,
                email,
                password_hash,
                email_verified: true
            });
            savedUser = await user.save();
        }

        // Create Default Workspace
        const wsName = workspace_name || `${full_name}'s Workspace`;
        const workspace = new DocuWorkspace({
            name: wsName,
            owner_id: savedUser._id
        });
        const savedWs = await workspace.save();

        // Join Workspace Member
        const membership = new DocuWorkspaceMember({
            workspace_id: savedWs._id,
            user_id: savedUser._id,
            role: 'owner',
            status: 'joined'
        });
        await membership.save();

        // Find active/first workspace to sign the JWT token
        const invitedMembership = await DocuWorkspaceMember.findOne({ user_id: savedUser._id, status: 'joined', role: { $ne: 'owner' } }).populate('workspace_id');
        const activeWs = invitedMembership ? invitedMembership.workspace_id : savedWs;
        const activeRole = invitedMembership ? invitedMembership.role : 'owner';

        // Generate Token
        const token = jwt.sign(
            { id: savedUser._id, email: savedUser.email, workspaceId: activeWs._id },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        await logAuditEvent({
            workspace_id: activeWs._id,
            user_id: savedUser._id,
            event_type: 'USER_SIGNED_UP',
            metadata: { email: savedUser.email }
        });

        res.status(201).json({ token, user: { id: savedUser._id, full_name: savedUser.full_name, email: savedUser.email }, workspace: activeWs, role: activeRole });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

        const user = await DocuUser.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

        // Find active/first workspace
        const member = await DocuWorkspaceMember.findOne({ user_id: user._id, status: 'joined' }).populate('workspace_id');
        if (!member) return res.status(400).json({ message: 'No workspaces associated with this user' });

        const token = jwt.sign(
            { id: user._id, email: user.email, workspaceId: member.workspace_id._id },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        await logAuditEvent({
            workspace_id: member.workspace_id._id,
            user_id: user._id,
            event_type: 'USER_LOGGED_IN',
            metadata: { email: user.email }
        });

        res.json({ token, user: { id: user._id, full_name: user.full_name, email: user.email }, workspace: member.workspace_id, role: member.role });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/auth/me', authenticateDocuToken, async (req, res) => {
    try {
        const user = await DocuUser.findById(req.user.id).select('-password_hash');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const members = await DocuWorkspaceMember.find({ user_id: user._id, status: 'joined' }).populate('workspace_id');
        const activeMembership = members.find(m => m.workspace_id._id.toString() === req.user.workspaceId) || members[0];
        
        res.json({
            user,
            workspace: activeMembership ? activeMembership.workspace_id : null,
            workspaces: members.map(m => m.workspace_id),
            role: activeMembership ? activeMembership.role : 'member'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/auth/logout', authenticateDocuToken, async (req, res) => {
    res.json({ message: 'Logout successful' });
});

// ==========================================
// 2. DASHBOARD DATA
// ==========================================

router.get('/dashboard/stats', authenticateDocuToken, async (req, res) => {
    try {
        const wsId = req.user.workspaceId;
        const total = await DocuDocumentNew.countDocuments({ workspace_id: wsId });
        const draft = await DocuDocumentNew.countDocuments({ workspace_id: wsId, status: 'draft' });
        const completed = await DocuDocumentNew.countDocuments({ workspace_id: wsId, status: 'completed' });
        const waiting = await DocuDocumentNew.countDocuments({ workspace_id: wsId, status: { $in: ['sent', 'viewed'] } });
        const expired = await DocuDocumentNew.countDocuments({ workspace_id: wsId, status: 'expired' });
        
        const templates = await DocuTemplate.countDocuments({ workspace_id: wsId });
        const team = await DocuWorkspaceMember.countDocuments({ workspace_id: wsId, status: 'joined' });

        res.json({ total, draft, completed, waiting, expired, templates, team });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/dashboard/activity', authenticateDocuToken, async (req, res) => {
    try {
        const logs = await DocuAuditLogNew.find({ workspace_id: req.user.workspaceId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('document_id', 'document_name')
            .populate('user_id', 'full_name');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 3. DOCUMENTS CRUD
// ==========================================

router.post('/documents/upload', requireCreateSendPermission, docuUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded' });
    try {
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        // Compute SHA-256 for original PDF
        const originalPath = getFilePathFromUrl(fileUrl);
        const originalPdfBytes = fs.readFileSync(originalPath);
        const originalHash = calculateHash(originalPdfBytes);

        res.json({ url: fileUrl, filename: req.file.originalname, original_hash: originalHash });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/parse', requireCreateSendPermission, parseUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No document file uploaded' });
    try {
        const buffer = req.file.buffer;
        const ext = path.extname(req.file.originalname).toLowerCase();
        let html = '';

        if (ext === '.pdf' || req.file.mimetype === 'application/pdf') {
            const pdf = new PDFParse(new Uint8Array(buffer));
            const data = await pdf.getText();
            const rawText = data.text || '';
            const lines = rawText.split(/\r?\n/);
            let htmlResult = '';
            let inList = false;

            for (let line of lines) {
                line = line.trim();
                if (!line) {
                    if (inList) {
                        htmlResult += '</ul>';
                        inList = false;
                    }
                    continue;
                }

                const isHeading = line.startsWith('###') || (line.toUpperCase() === line && line.length < 60 && !line.startsWith('-') && !line.startsWith('*'));
                const isListItem = line.startsWith('-') || line.startsWith('*') || /^\d+\.\s/.test(line);

                if (isListItem) {
                    if (!inList) {
                        htmlResult += '<ul style="margin-left: 20px; list-style-type: disc;">';
                        inList = true;
                    }
                    const cleanItem = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
                    htmlResult += `<li>${cleanItem}</li>`;
                } else {
                    if (inList) {
                        htmlResult += '</ul>';
                        inList = false;
                    }
                    if (isHeading) {
                        const cleanHeading = line.replace(/^###\s*/, '');
                        htmlResult += `<h2>${cleanHeading}</h2>`;
                    } else {
                        htmlResult += `<p>${line}</p>`;
                    }
                }
            }
            if (inList) {
                htmlResult += '</ul>';
            }
            html = htmlResult;
        } else if (ext === '.docx' || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const data = await mammoth.convertToHtml({ buffer: buffer });
            html = data.value;
        } else {
            return res.status(400).json({ message: 'Unsupported file type. Only PDF and DOCX files are allowed.' });
        }

        res.json({
            html: html || '',
            name: path.basename(req.file.originalname, ext)
        });
    } catch (err) {
        console.error('Error parsing document:', err);
        res.status(500).json({ message: 'Failed to extract text from document: ' + err.message });
    }
});

router.get('/documents', authenticateDocuToken, async (req, res) => {
    try {
        const { status } = req.query;
        const query = { workspace_id: req.user.workspaceId };
        if (status) {
            query.status = status;
        } else {
            query.status = { $ne: 'archived' };
        }
        
        const docs = await DocuDocumentNew.find(query).sort({ createdAt: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/create-from-text', requireCreateSendPermission, async (req, res) => {
    try {
        const { document_name, content, blocks } = req.body;
        if (!document_name || (!content && !blocks)) {
            return res.status(400).json({ message: 'Document name and content/blocks are required' });
        }

        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage([595.28, 841.89]); // A4
        let { width, height } = page.getSize();
        
        const margin = 50;
        let y = height - margin;
        const widthLimit = width - (margin * 2);
        
        // Draw Document Title
        page.drawText(document_name.toUpperCase(), {
            x: margin,
            y: y - 10,
            size: 16,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        y -= 45;

        if (blocks && Array.isArray(blocks)) {
            for (const block of blocks) {
                const type = block.type || 'p';
                const text = sanitizeTextForPdf(block.text || '');
                
                if (text.trim() === '') {
                    y -= 10;
                    continue;
                }

                let currentFont = font;
                let fontSize = 10;
                let leading = 14;
                let blockMarginBefore = 4;
                let blockMarginAfter = 8;
                let leftIndent = margin;
                let textColor = rgb(0.1, 0.1, 0.1);

                if (type === 'h1') {
                    currentFont = boldFont;
                    fontSize = 18;
                    leading = 22;
                    blockMarginBefore = 16;
                    blockMarginAfter = 10;
                    textColor = rgb(0.05, 0.05, 0.1);
                } else if (type === 'h2') {
                    currentFont = boldFont;
                    fontSize = 14;
                    leading = 18;
                    blockMarginBefore = 12;
                    blockMarginAfter = 6;
                    textColor = rgb(0.05, 0.05, 0.15);
                } else if (type === 'bullet') {
                    currentFont = font;
                    fontSize = 10;
                    leading = 14;
                    blockMarginBefore = 2;
                    blockMarginAfter = 4;
                    leftIndent = margin + 20;
                }

                y -= blockMarginBefore;

                const textLimit = width - (leftIndent + margin);
                
                if (type === 'bullet') {
                    if (y - leading < margin) {
                        page = pdfDoc.addPage([595.28, 841.89]);
                        y = height - margin;
                    }
                    page.drawText('•', {
                        x: margin + 8,
                        y: y,
                        size: fontSize,
                        font: currentFont,
                        color: textColor
                    });
                }

                const words = text.split(' ');
                let currentLine = '';

                for (const word of words) {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    const widthOfTest = currentFont.widthOfTextAtSize(testLine, fontSize);

                    if (widthOfTest > textLimit) {
                        if (y - leading < margin) {
                            page = pdfDoc.addPage([595.28, 841.89]);
                            y = height - margin;
                        }
                        page.drawText(currentLine, {
                            x: leftIndent,
                            y: y,
                            size: fontSize,
                            font: currentFont,
                            color: textColor
                        });
                        y -= leading;
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }

                if (currentLine) {
                    if (y - leading < margin) {
                        page = pdfDoc.addPage([595.28, 841.89]);
                        y = height - margin;
                    }
                    page.drawText(currentLine, {
                        x: leftIndent,
                        y: y,
                        size: fontSize,
                        font: currentFont,
                        color: textColor
                    });
                    y -= leading;
                }

                y -= blockMarginAfter;
            }
        } else if (content) {
            const lines = content.split('\n');
            for (const rawLine of lines) {
                const cleanLine = sanitizeTextForPdf(rawLine.trim());
                if (cleanLine === '') {
                    y -= 12;
                    continue;
                }

                const isHeading = cleanLine.startsWith('###') || (cleanLine.startsWith('**') && cleanLine.endsWith('**')) || (cleanLine.toUpperCase() === cleanLine && cleanLine.length < 50);
                const currentFont = isHeading ? boldFont : font;
                const fontSize = isHeading ? 12 : 10;
                const leading = isHeading ? 18 : 14;

                const words = cleanLine.replace(/^###\s*/, '').replace(/^\*\*\s*/, '').replace(/\*\*\s*$/, '').split(' ');
                let currentLine = '';
                
                for (const word of words) {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    const widthOfTest = currentFont.widthOfTextAtSize(testLine, fontSize);
                    
                    if (widthOfTest > widthLimit) {
                        if (y - leading < margin) {
                            page = pdfDoc.addPage([595.28, 841.89]);
                            y = height - margin;
                        }
                        
                        page.drawText(currentLine, {
                            x: margin,
                            y: y,
                            size: fontSize,
                            font: currentFont,
                            color: rgb(0.1, 0.1, 0.1)
                        });
                        y -= leading;
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                
                if (currentLine) {
                    if (y - leading < margin) {
                        page = pdfDoc.addPage([595.28, 841.89]);
                        y = height - margin;
                    }
                    page.drawText(currentLine, {
                        x: margin,
                        y: y,
                        size: fontSize,
                        font: currentFont,
                        color: rgb(0.1, 0.1, 0.1)
                    });
                    y -= leading + 4;
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        const filename = `docu-text-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
        const localPath = path.join(__dirname, '../uploads', filename);
        
        if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
            fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
        }
        
        fs.writeFileSync(localPath, pdfBytes);
        
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
        const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

        const doc = new DocuDocumentNew({
            workspace_id: req.user.workspaceId,
            owner_id: req.user.id,
            document_name: document_name,
            original_file_url: fileUrl,
            original_hash: hash,
            fields: [],
            recipients: [],
            status: 'draft',
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        const saved = await doc.save();
        res.status(201).json(saved);
    } catch (err) {
        console.error('Error generating PDF from text:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents', requireCreateSendPermission, async (req, res) => {
    try {
        const { document_name, original_file_url, original_hash, fields, recipients, expires_at } = req.body;
        
        const doc = new DocuDocumentNew({
            workspace_id: req.user.workspaceId,
            owner_id: req.user.id,
            document_name,
            original_file_url,
            original_hash: original_hash || '',
            fields: fields || [],
            recipients: recipients || [],
            expires_at: expires_at ? new Date(expires_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

        const saved = await doc.save();
        await logAuditEvent({
            workspace_id: req.user.workspaceId,
            document_id: saved._id,
            user_id: req.user.id,
            event_type: 'DOCUMENT_CREATED',
            metadata: { document_name }
        });

        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/documents/:id', authenticateDocuToken, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/documents/:id', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        if (doc.status === 'completed') return res.status(400).json({ message: 'Completed documents cannot be modified' });

        const { fields, document_name, expires_at, recipients, signing_order_enabled } = req.body;
        if (fields) doc.fields = fields;
        if (document_name) doc.document_name = document_name;
        if (expires_at) doc.expires_at = new Date(expires_at);
        if (recipients) doc.recipients = recipients;
        if (signing_order_enabled !== undefined) doc.signing_order_enabled = signing_order_enabled;

        const saved = await doc.save();
        await logAuditEvent({
            workspace_id: req.user.workspaceId,
            document_id: saved._id,
            user_id: req.user.id,
            event_type: 'FIELD_UPDATED',
            metadata: { fields_count: fields ? fields.length : doc.fields.length }
        });

        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/documents/:id', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOneAndDelete({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        
        await DocuAuditLogNew.deleteMany({ document_id: doc._id });
        await DocuReminder.deleteMany({ document_id: doc._id });

        res.json({ message: 'Document permanently deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/:id/archive', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOneAndUpdate(
            { _id: req.params.id, workspace_id: req.user.workspaceId },
            { status: 'archived', archived_at: new Date() },
            { new: true }
        );
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        
        await logAuditEvent({
            workspace_id: req.user.workspaceId,
            document_id: doc._id,
            user_id: req.user.id,
            event_type: 'DOCUMENT_ARCHIVED'
        });

        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/:id/cancel', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOneAndUpdate(
            { _id: req.params.id, workspace_id: req.user.workspaceId },
            { status: 'declined', cancelled_at: new Date() },
            { new: true }
        );
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        await logAuditEvent({
            workspace_id: req.user.workspaceId,
            document_id: doc._id,
            user_id: req.user.id,
            event_type: 'DOCUMENT_CANCELLED'
        });

        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/:id/duplicate', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const duplicate = new DocuDocumentNew({
            workspace_id: doc.workspace_id,
            owner_id: req.user.id,
            document_name: `${doc.document_name} (Copy)`,
            original_file_url: doc.original_file_url,
            original_hash: doc.original_hash,
            fields: doc.fields.map(f => {
                const fObj = f.toObject();
                delete fObj._id;
                fObj.value = '';
                fObj.signature_data = '';
                return fObj;
            }),
            recipients: doc.recipients.map(r => {
                const rObj = r.toObject();
                delete rObj._id;
                rObj.secure_token = crypto.randomBytes(32).toString('hex');
                rObj.status = 'sent';
                rObj.viewed_at = undefined;
                rObj.signed_at = undefined;
                rObj.completed_at = undefined;
                return rObj;
            }),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        const saved = await duplicate.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 4. FIELDS BULK-SAVE
// ==========================================

router.post('/documents/:id/fields/bulk-save', requireCreateSendPermission, async (req, res) => {
    try {
        const { fields, recipients } = req.body;
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        if (fields) doc.fields = fields;
        if (recipients) doc.recipients = recipients;
        
        const saved = await doc.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 5. DISPATCH FLOW (SEND SIGNING LINK)
// ==========================================

router.post('/documents/:id/send', requireCreateSendPermission, async (req, res) => {
    try {
        const { message, expirationDays } = req.body;
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        if (doc.recipients.length === 0) {
            return res.status(400).json({ message: 'Please configure at least one recipient' });
        }

        const days = expirationDays ? parseInt(expirationDays) : 30;
        doc.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        doc.status = 'sent';
        doc.sent_at = new Date();

        // Assign tokens to all recipients
        doc.recipients.forEach(r => {
            if (!r.secure_token) {
                r.secure_token = crypto.randomBytes(32).toString('hex');
            }
        });

        // Sequential mode: set all to pending, then activate only the first signer
        // Parallel mode: set all signers to sent immediately
        if (doc.signing_order_enabled) {
            const sortedSigners = [...doc.recipients]
                .filter(r => r.role === 'signer')
                .sort((a, b) => a.signing_order - b.signing_order);
            doc.recipients.forEach(r => {
                // CC and viewers stay pending (they receive completion email later)
                if (r.role === 'signer') r.status = 'pending';
            });
            if (sortedSigners.length > 0) {
                // Activate only the first signer
                const firstSigner = doc.recipients.find(r => r._id.toString() === sortedSigners[0]._id.toString());
                if (firstSigner) firstSigner.status = 'sent';
            }
        } else {
            // Parallel: activate all signers simultaneously
            doc.recipients.forEach(r => {
                if (r.role === 'signer') r.status = 'sent';
            });
        }

        const savedDoc = await doc.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const sender = await DocuUser.findById(req.user.id);

        const signersToNotify = [];
        if (savedDoc.signing_order_enabled) {
            const sortedRecipients = [...savedDoc.recipients].sort((a, b) => a.signing_order - b.signing_order);
            const activeSigner = sortedRecipients.find(r => r.status === 'sent' && r.role === 'signer');
            if (activeSigner) signersToNotify.push(activeSigner);
        } else {
            savedDoc.recipients.forEach(r => {
                if (r.status === 'sent' && r.role === 'signer') {
                    signersToNotify.push(r);
                }
            });
        }

        for (const recipientToNotify of signersToNotify) {
            const signingLink = `${frontendUrl}/docu/public/sign/${recipientToNotify.secure_token}`;
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <h2 style="color: #3b82f6; text-align: center; font-size: 24px; margin-bottom: 20px;">Signature Request</h2>
                <p style="font-size: 16px; line-height: 1.6;">Hello ${recipientToNotify.name},</p>
                <p style="font-size: 16px; line-height: 1.6;"><strong>${sender ? sender.full_name : 'A member'}</strong> has sent you <strong>"${savedDoc.document_name}"</strong> to sign digitally.</p>
                ${message ? `<div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; font-style: italic; border-radius: 4px; color: #555;">"${message}"</div>` : ''}
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${signingLink}" style="background-color: #3b82f6; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Review and Sign</a>
                </div>
                <p style="font-size: 13px; color: #777; text-align: center; margin-top: 25px;">This secure link will expire on <strong>${new Date(savedDoc.expires_at).toLocaleDateString('en-GB')}</strong>.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">This is a secure automated notification from BritSync Docu.</p>
              </div>
            `;

            try {
                await emailTransporter.sendMail({
                    from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
                    to: recipientToNotify.email,
                    subject: `Please Sign: ${savedDoc.document_name}`,
                    html: emailHtml
                });
            } catch (emailErr) {
                console.error('[EMAIL] Failed to send initial sign request (non-fatal):', emailErr.message);
            }

            await logAuditEvent({
                workspace_id: req.user.workspaceId,
                document_id: savedDoc._id,
                recipient_id: recipientToNotify.secure_token,
                user_id: req.user.id,
                event_type: 'DOCUMENT_SENT',
                metadata: { recipient_email: recipientToNotify.email }
            });
        }

        res.json(savedDoc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/:id/resend', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const sortedRecipients = [...doc.recipients].sort((a, b) => a.signing_order - b.signing_order);
        const activeSigner = sortedRecipients.find(r => ['sent', 'viewed'].includes(r.status) && r.role === 'signer');

        if (!activeSigner) return res.status(400).json({ message: 'No active recipient awaiting signature' });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const signingLink = `${frontendUrl}/docu/public/sign/${activeSigner.secure_token}`;
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px;">
            <h2 style="color: #3b82f6; text-align: center; font-size: 24px;">Reminder: Document Signature Request</h2>
            <p style="font-size: 16px; line-height: 1.6;">Hello ${activeSigner.name},</p>
            <p style="font-size: 16px; line-height: 1.6;">This is a reminder that you have a document waiting to be signed: <strong>"${doc.document_name}"</strong>.</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${signingLink}" style="background-color: #3b82f6; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Open Document</a>
            </div>
          </div>
        `;

        await emailTransporter.sendMail({
            from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
            to: activeSigner.email,
            subject: `Reminder: Please Sign ${doc.document_name}`,
            html: emailHtml
        });

        await logAuditEvent({
            workspace_id: req.user.workspaceId,
            document_id: doc._id,
            recipient_id: activeSigner.secure_token,
            event_type: 'REMINDER_SENT'
        });

        res.json({ message: 'Reminder email sent successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 6. PUBLIC SIGNING ENDPOINTS (NO ACCOUNT REQUIRED)
// ==========================================

router.get('/public/sign/:token', async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.token }).populate('workspace_id');
        if (!doc) return res.status(404).json({ message: 'Invalid secure token' });

        const recipient = doc.recipients.find(r => r.secure_token === req.params.token);

        // Check completion status
        if (doc.status === 'completed') {
            return res.json({ doc, recipient, state: 'completed' });
        }

        // Check expiration
        const now = new Date();
        if (doc.expires_at && doc.expires_at < now) {
            doc.status = 'expired';
            await doc.save();

            await logAuditEvent({
                workspace_id: doc.workspace_id,
                document_id: doc._id,
                recipient_id: recipient.secure_token,
                event_type: 'DOCUMENT_EXPIRED',
                ip_address: req.ip || req.headers['x-forwarded-for'],
                user_agent: req.headers['user-agent']
            });

            return res.json({ state: 'expired' });
        }

        // Block sequential signer who has not been activated yet
        if (recipient.status === 'pending') {
            return res.json({ doc, recipient, state: 'not_your_turn' });
        }

        // Mark viewed
        if (recipient.status === 'sent') {
            recipient.status = 'viewed';
            recipient.viewed_at = new Date();
            if (doc.status === 'sent') {
                doc.status = 'viewed';
            }
            await doc.save();

            await logAuditEvent({
                workspace_id: doc.workspace_id,
                document_id: doc._id,
                recipient_id: recipient.secure_token,
                event_type: 'DOCUMENT_VIEWED',
                ip_address: req.ip || req.headers['x-forwarded-for'],
                user_agent: req.headers['user-agent']
            });
        }

        res.json({ doc, recipient, state: 'signing' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/public/sign/:token/complete', async (req, res) => {
    try {
        const { fields } = req.body;
        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.token });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        if (doc.status === 'completed') return res.status(400).json({ message: 'Document is already completed' });

        const recipient = doc.recipients.find(r => r.secure_token === req.params.token);

        // Validate required fields
        const missingFields = [];
        for (const f of doc.fields) {
            const isMyField = f.assigned_recipient_id === recipient._id.toString() || f.assigned_recipient_id === recipient.email;
            if (isMyField && f.required) {
                const clientField = fields.find(cf => cf._id === f._id.toString());
                const val = clientField ? clientField.value : f.value;
                const sig = clientField ? clientField.signature_data : f.signature_data;

                if (['user_signature', 'initials', 'stamp'].includes(f.field_type)) {
                    if (!sig) missingFields.push(f.label || f.field_type);
                } else if (f.field_type === 'checkbox') {
                    if (val !== 'true' && val !== 'checked') missingFields.push(f.label || f.field_type);
                } else {
                    if (!val || !val.trim()) missingFields.push(f.label || f.field_type);
                }
            }
        }

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                message: `Please complete all required fields: ${missingFields.join(', ')}` 
            });
        }

        // Update fields locally
        for (const f of fields) {
            const docField = doc.fields.id(f._id);
            if (docField) {
                const isMyField = docField.assigned_recipient_id === recipient._id.toString() || docField.assigned_recipient_id === recipient.email;
                if (isMyField) {
                    if (f.signature_data) {
                        docField.signature_data = f.signature_data;
                        docField.value = 'Signed';
                    } else if (f.value !== undefined) {
                        docField.value = f.value;
                    }
                }
            }
        }

        // Mark recipient completed
        recipient.status = 'completed';
        recipient.completed_at = new Date();
        recipient.ip_address = req.ip || req.headers['x-forwarded-for'];
        recipient.user_agent = req.headers['user-agent'];

        // Determine if all required signers have signed
        const allSigned = doc.recipients.every(r => r.role !== 'signer' || r.status === 'completed');

        if (allSigned) {
            // Compile final PDF
            const { filename, finalHash } = await compileFinalPdfNew(doc);
            const finalFileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
            
            doc.final_file_url = finalFileUrl;
            doc.final_hash = finalHash;
            doc.status = 'completed';
            doc.completed_at = new Date();

            // Generate Audit Certificate
            try {
                const logs = await DocuAuditLogNew.find({ document_id: doc._id }).sort({ createdAt: 1 });
                const auditFilename = await generateAuditReportPdf(doc, logs);
                doc.audit_report_url = `${req.protocol}://${req.get('host')}/uploads/${auditFilename}`;
            } catch (auditErr) {
                console.error('Failed to generate audit certificate:', auditErr);
            }

            await logAuditEvent({
                workspace_id: doc.workspace_id,
                document_id: doc._id,
                recipient_id: recipient.secure_token,
                event_type: 'DOCUMENT_COMPLETED',
                ip_address: req.ip || req.headers['x-forwarded-for'],
                user_agent: req.headers['user-agent']
            });

            await logAuditEvent({
                workspace_id: doc.workspace_id,
                document_id: doc._id,
                event_type: 'SIGNED_PDF_GENERATED',
                metadata: { final_file_url: finalFileUrl, hash: finalHash }
            });

            // Send completion email to all signers + owner (non-blocking)
            const owner = await DocuUser.findById(doc.owner_id);
            const allEmails = [...doc.recipients.map(r => r.email), owner?.email].filter(Boolean);

            const emailHtml = `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px;">
                <h2 style="color: #10b981; text-align: center; font-size: 24px;">Document Completed Successfully</h2>
                <p style="font-size: 16px; line-height: 1.6;">The document <strong>"${doc.document_name}"</strong> has been fully signed and completed by all recipients.</p>
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${finalFileUrl}" style="background-color: #10b981; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Download Signed PDF</a>
                </div>
                <p style="font-size: 12px; color: #888;">Document hash: ${finalHash}</p>
              </div>
            `;

            try {
                for (const mail of allEmails) {
                    await emailTransporter.sendMail({
                        from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
                        to: mail,
                        subject: `Completed: ${doc.document_name}`,
                        html: emailHtml
                    });
                }
            } catch (emailErr) {
                console.error('[EMAIL] Failed to send completion emails (non-fatal):', emailErr.message);
            }

            // Trigger notification for owner
            try {
                await createNotification({
                    workspace_id: doc.workspace_id,
                    user_id: doc.owner_id,
                    document_id: doc._id,
                    type: 'completed',
                    title: 'Document Completed',
                    message: `"${doc.document_name}" has been completed by all signers.`
                });
            } catch (notifErr) {
                console.error('[NOTIF] Failed to create completion notification (non-fatal):', notifErr.message);
            }
        } else if (doc.signing_order_enabled) {
            // Sequential signing order: Activate and notify the next pending signer
            const sorted = [...doc.recipients].sort((a, b) => a.signing_order - b.signing_order);
            const nextSigner = sorted.find(r => r.status === 'pending' && r.role === 'signer');
            if (nextSigner) {
                // Activate this signer so they can access their link
                nextSigner.status = 'sent';
                await doc.save();
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const signingLink = `${frontendUrl}/docu/public/sign/${nextSigner.secure_token}`;
                
                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e0e0e0; border-radius: 12px;">
                    <h2 style="color: #3b82f6; text-align: center; font-size: 24px;">Signature Request</h2>
                    <p style="font-size: 16px; line-height: 1.6;">Hello ${nextSigner.name},</p>
                    <p style="font-size: 16px; line-height: 1.6;">You have been requested to sign <strong>"${doc.document_name}"</strong>.</p>
                    <div style="text-align: center; margin: 35px 0;">
                      <a href="${signingLink}" style="background-color: #3b82f6; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Open and Sign</a>
                    </div>
                  </div>
                `;

                try {
                    await emailTransporter.sendMail({
                        from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
                        to: nextSigner.email,
                        subject: `Signature Request: ${doc.document_name}`,
                        html: emailHtml
                    });
                } catch (emailErr) {
                    console.error('[EMAIL] Failed to send next-signer email (non-fatal):', emailErr.message);
                }
            }

            await logAuditEvent({
                workspace_id: doc.workspace_id,
                document_id: doc._id,
                recipient_id: recipient.secure_token,
                event_type: 'USER_SIGNATURE_ADDED',
                ip_address: req.ip || req.headers['x-forwarded-for'],
                user_agent: req.headers['user-agent']
            });
        } else {
            await logAuditEvent({
                workspace_id: doc.workspace_id,
                document_id: doc._id,
                recipient_id: recipient.secure_token,
                event_type: 'USER_SIGNATURE_ADDED',
                ip_address: req.ip || req.headers['x-forwarded-for'],
                user_agent: req.headers['user-agent']
            });
        }

        const saved = await doc.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/public/sign/:token/download', async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.token });
        if (!doc) return res.status(404).json({ message: 'Invalid token' });
        if (doc.status !== 'completed' || !doc.final_file_url) {
            return res.status(400).json({ message: 'Signed document is not completed yet.' });
        }

        await logAuditEvent({
            workspace_id: doc.workspace_id,
            document_id: doc._id,
            recipient_id: req.params.token,
            event_type: 'FINAL_PDF_DOWNLOADED',
            ip_address: req.ip || req.headers['x-forwarded-for'],
            user_agent: req.headers['user-agent']
        });

        res.redirect(doc.final_file_url);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/public/sign/:token/download-audit', async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.token });
        if (!doc) return res.status(404).json({ message: 'Invalid token' });
        if (doc.status !== 'completed' || !doc.audit_report_url) {
            return res.status(400).json({ message: 'Audit certificate is not generated yet.' });
        }

        const localPath = getFilePathFromUrl(doc.audit_report_url);
        if (localPath && fs.existsSync(localPath)) {
            res.download(localPath, `audit-certificate-${doc.document_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`);
        } else {
            res.redirect(doc.audit_report_url);
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /public/verify - Verify document authenticity by checking its SHA-256 hash
router.post('/public/verify', docuUpload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded for verification' });
    try {
        const localPath = path.join(__dirname, '../uploads', req.file.filename);
        const fileBuffer = fs.readFileSync(localPath);
        const calculatedHash = calculateHash(fileBuffer);
        
        // Clean up the uploaded temporary verification file immediately
        fs.unlinkSync(localPath);

        const doc = await DocuDocumentNew.findOne({ final_hash: calculatedHash })
            .populate('workspace_id', 'name');

        if (!doc) {
            return res.json({
                verified: false,
                message: 'This document could not be verified. It may have been modified since it was signed, or it was not generated by BritSync Docu.'
            });
        }

        res.json({
            verified: true,
            document_name: doc.document_name,
            completed_at: doc.completed_at,
            workspace_name: doc.workspace_id?.name || 'Unknown Workspace',
            hash: calculatedHash,
            recipients: doc.recipients.map(r => ({
                name: r.name,
                email: r.email,
                role: r.role,
                status: r.status,
                signed_at: r.signed_at,
                ip_address: r.ip_address
            }))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 7. TEMPLATES CRUD
// ==========================================

router.get('/templates', authenticateDocuToken, async (req, res) => {
    try {
        let list = await DocuTemplate.find({ workspace_id: req.user.workspaceId }).sort({ createdAt: -1 });
        
        if (list.length === 0) {
            const hostUrl = `${req.protocol}://${req.get('host')}`;
            const sampleFileUrl = `${hostUrl}/uploads/docu-1782063127108-BritSync_Docu_Mock_Signature_Form.pdf`;
            
            const defaultTemplates = [
                {
                    workspace_id: req.user.workspaceId,
                    owner_id: req.user.id,
                    template_name: 'Mutual Non-Disclosure Agreement (NDA)',
                    description: 'Standard bi-lateral confidentiality agreement for commercial discussions and IP protection.',
                    category: 'Legal',
                    file_url: sampleFileUrl,
                    fields_json: JSON.stringify([
                        {
                            page_number: 1,
                            field_type: 'user_signature',
                            label: 'Signature',
                            required: true,
                            x_percent: 15,
                            y_percent: 75,
                            width_percent: 25,
                            height_percent: 8,
                            assigned_recipient_id: 'signer_1'
                        },
                        {
                            page_number: 1,
                            field_type: 'date',
                            label: 'Date',
                            required: true,
                            x_percent: 45,
                            y_percent: 75,
                            width_percent: 15,
                            height_percent: 4,
                            assigned_recipient_id: 'signer_1'
                        }
                    ]),
                    recipients_json: JSON.stringify([
                        {
                            role: 'signer',
                            name: 'Recipient Signer',
                            email: 'signer@example.com',
                            signing_order: 1
                        }
                    ]),
                    default_message: 'Please review and execute the Mutual NDA for our upcoming collaboration.'
                },
                {
                    workspace_id: req.user.workspaceId,
                    owner_id: req.user.id,
                    template_name: 'Consulting Services Agreement',
                    description: 'Standard independent contractor agreement defining work scope, intellectual property assignment, and payment terms.',
                    category: 'Agreements',
                    file_url: sampleFileUrl,
                    fields_json: JSON.stringify([
                        {
                            page_number: 1,
                            field_type: 'user_signature',
                            label: 'Signature',
                            required: true,
                            x_percent: 15,
                            y_percent: 70,
                            width_percent: 25,
                            height_percent: 8,
                            assigned_recipient_id: 'signer_1'
                        }
                    ]),
                    recipients_json: JSON.stringify([
                        {
                            role: 'signer',
                            name: 'Consultant',
                            email: 'consultant@example.com',
                            signing_order: 1
                        }
                    ]),
                    default_message: 'Please execute this service agreement to commence our consulting contract.'
                }
            ];

            await DocuTemplate.insertMany(defaultTemplates);
            list = await DocuTemplate.find({ workspace_id: req.user.workspaceId }).sort({ createdAt: -1 });
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/templates', requireCreateSendPermission, async (req, res) => {
    try {
        const { template_name, description, category, file_url, fields_json, recipients_json, default_message } = req.body;
        const temp = new DocuTemplate({
            workspace_id: req.user.workspaceId,
            owner_id: req.user.id,
            template_name,
            description,
            category: category || 'General',
            file_url,
            fields_json: fields_json || '[]',
            recipients_json: recipients_json || '[]',
            default_message
        });

        const saved = await temp.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/templates/:id', authenticateDocuToken, async (req, res) => {
    try {
        const t = await DocuTemplate.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!t) return res.status(404).json({ message: 'Template not found' });
        res.json(t);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/templates/:id', requireCreateSendPermission, async (req, res) => {
    try {
        const t = await DocuTemplate.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!t) return res.status(404).json({ message: 'Template not found' });

        const { template_name, description, category, fields_json, recipients_json, default_message } = req.body;
        if (template_name) t.template_name = template_name;
        if (description) t.description = description;
        if (category) t.category = category;
        if (fields_json) t.fields_json = fields_json;
        if (recipients_json) t.recipients_json = recipients_json;
        if (default_message) t.default_message = default_message;

        const saved = await t.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/templates/:id', requireCreateSendPermission, async (req, res) => {
    try {
        const t = await DocuTemplate.findOneAndDelete({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!t) return res.status(404).json({ message: 'Template not found' });
        res.json({ message: 'Template deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/templates/:id/use', requireCreateSendPermission, async (req, res) => {
    try {
        const t = await DocuTemplate.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!t) return res.status(404).json({ message: 'Template not found' });

        const originalPath = getFilePathFromUrl(t.file_url);
        let originalHash = '';
        if (fs.existsSync(originalPath)) {
            const buf = fs.readFileSync(originalPath);
            originalHash = calculateHash(buf);
        }

        const doc = new DocuDocumentNew({
            workspace_id: req.user.workspaceId,
            owner_id: req.user.id,
            document_name: `${t.template_name} (Instance)`,
            original_file_url: t.file_url,
            original_hash: originalHash,
            status: 'draft',
            source_type: 'template',
            template_id: t._id,
            fields: JSON.parse(t.fields_json || '[]').map(f => {
                delete f._id;
                f.value = '';
                f.signature_data = '';
                return f;
            }),
            recipients: JSON.parse(t.recipients_json || '[]').map(r => {
                delete r._id;
                r.secure_token = crypto.randomBytes(32).toString('hex');
                r.status = 'sent';
                return r;
            })
        });

        const saved = await doc.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/templates/:id/duplicate', requireCreateSendPermission, async (req, res) => {
    try {
        const t = await DocuTemplate.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!t) return res.status(404).json({ message: 'Template not found' });

        const clone = new DocuTemplate({
            workspace_id: t.workspace_id,
            owner_id: req.user.id,
            template_name: `${t.template_name} (Copy)`,
            description: t.description,
            category: t.category,
            file_url: t.file_url,
            fields_json: t.fields_json,
            recipients_json: t.recipients_json,
            default_message: t.default_message
        });

        const saved = await clone.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/documents/:id/save-as-template', requireCreateSendPermission, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const t = new DocuTemplate({
            workspace_id: req.user.workspaceId,
            owner_id: req.user.id,
            template_name: `${doc.document_name} Template`,
            description: `Template saved from ${doc.document_name}`,
            file_url: doc.original_file_url,
            fields_json: JSON.stringify(doc.fields),
            recipients_json: JSON.stringify(doc.recipients.map(r => ({
                name: r.name,
                email: r.email,
                role: r.role,
                signing_order: r.signing_order
            }))),
            default_message: ''
        });

        const saved = await t.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 8. CONTACTS CRUD
// ==========================================

router.get('/contacts', authenticateDocuToken, async (req, res) => {
    try {
        const list = await DocuContact.find({ workspace_id: req.user.workspaceId }).sort({ name: 1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/contacts/bulk', requireCreateSendPermission, async (req, res) => {
    try {
        const { contacts } = req.body;
        if (!Array.isArray(contacts)) return res.status(400).json({ message: 'Contacts array is required' });

        const created = [];
        for (const c of contacts) {
            if (!c.name || !c.email) continue;
            const newC = new DocuContact({
                workspace_id: req.user.workspaceId,
                name: c.name,
                email: c.email,
                phone: c.phone || '',
                company: c.company || '',
                address: c.address || '',
                notes: c.notes || '',
                tags_json: JSON.stringify(c.tags || [])
            });
            const saved = await newC.save();
            created.push(saved);
        }
        res.status(201).json(created);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/contacts', requireCreateSendPermission, async (req, res) => {
    try {
        const { name, email, phone, company, address, notes, tags } = req.body;
        const contact = new DocuContact({
            workspace_id: req.user.workspaceId,
            name,
            email,
            phone: phone || '',
            company: company || '',
            address: address || '',
            notes: notes || '',
            tags_json: JSON.stringify(tags || [])
        });

        const saved = await contact.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/contacts/:id', requireCreateSendPermission, async (req, res) => {
    try {
        const contact = await DocuContact.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!contact) return res.status(404).json({ message: 'Contact not found' });

        const { name, email, phone, company, address, notes, tags } = req.body;
        if (name) contact.name = name;
        if (email) contact.email = email;
        if (phone !== undefined) contact.phone = phone;
        if (company !== undefined) contact.company = company;
        if (address !== undefined) contact.address = address;
        if (notes !== undefined) contact.notes = notes;
        if (tags) contact.tags_json = JSON.stringify(tags);

        const saved = await contact.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/contacts/:id', requireCreateSendPermission, async (req, res) => {
    try {
        const c = await DocuContact.findOneAndDelete({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!c) return res.status(404).json({ message: 'Contact not found' });
        res.json({ message: 'Contact deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 9. TEAM MANAGEMENT
// ==========================================

router.get('/team', authenticateDocuToken, async (req, res) => {
    try {
        const members = await DocuWorkspaceMember.find({ workspace_id: req.user.workspaceId })
            .populate('user_id', 'full_name email avatar_url');
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/team/invite', requireAdminPermission, async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const workspace = await DocuWorkspace.findById(req.user.workspaceId);
        const workspaceName = workspace ? workspace.name : 'a Workspace';
        
        const inviter = await DocuUser.findById(req.user.id);
        const inviterName = inviter ? inviter.full_name : 'A team member';

        // Check if user exists
        let isNewUser = false;
        let user = await DocuUser.findOne({ email });
        if (!user) {
            isNewUser = true;
            // Create a dummy user invite
            const dummyPassword = crypto.randomBytes(16).toString('hex');
            const password_hash = await bcrypt.hash(dummyPassword, 10);
            user = new DocuUser({
                full_name: email.split('@')[0],
                email,
                password_hash,
                email_verified: false
            });
            user = await user.save();
        } else if (!user.email_verified) {
            isNewUser = true;
        }

        // Check membership
        const existingMember = await DocuWorkspaceMember.findOne({ workspace_id: req.user.workspaceId, user_id: user._id });
        if (existingMember) return res.status(400).json({ message: 'User is already a member or invited to this workspace' });

        const member = new DocuWorkspaceMember({
            workspace_id: req.user.workspaceId,
            user_id: user._id,
            role: role || 'member',
            status: isNewUser ? 'invited' : 'joined', // Auto-join if user is already registered, or keep invited
            invited_by: req.user.id
        });
        await member.save();

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const actionUrl = isNewUser 
            ? `${frontendUrl}/docu/signup?email=${encodeURIComponent(email)}`
            : `${frontendUrl}/docu/login`;
        const buttonText = isNewUser ? 'Register & Join Workspace' : 'Log In to Workspace';

        const emailHtml = `
          <div style="font-family: 'Inter', Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 40px 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 2rem;">
              <h2 style="color: #2563eb; font-size: 24px; font-weight: 800; margin: 0;">BritSync <span style="color: #0f172a;">Docu</span></h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Secure Document Signing & Workspaces</p>
            </div>
            <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Workspace Invitation</h3>
            <p style="font-size: 15px; line-height: 1.6; color: #334155;">Hello,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155;">
              <strong>${inviterName}</strong> has invited you to join the workspace <strong>"${workspaceName}"</strong> on BritSync Docu.
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155;">
              Your assigned role is <strong>${role || 'member'}</strong>.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
                ${buttonText}
              </a>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              If you have any questions, please contact the workspace administrator directly.
            </p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
              This is an automated security invite from BritSync Docu.
            </p>
          </div>
        `;

        try {
            await emailTransporter.sendMail({
                from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
                to: email,
                subject: `Invitation to join workspace: ${workspaceName}`,
                html: emailHtml
            });
        } catch (emailErr) {
            console.error('[EMAIL] Failed to send team invite email (non-fatal):', emailErr.message);
        }

        res.status(201).json({ message: 'User invited successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/team/:memberId', requireAdminPermission, async (req, res) => {
    try {
        const member = await DocuWorkspaceMember.findOne({ _id: req.params.memberId, workspace_id: req.user.workspaceId });
        if (!member) return res.status(404).json({ message: 'Team member not found' });
        if (member.role === 'owner') return res.status(400).json({ message: 'Cannot remove workspace owner' });

        await DocuWorkspaceMember.findByIdAndDelete(member._id);
        res.json({ message: 'Team member removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/team/:memberId/role', requireAdminPermission, async (req, res) => {
    try {
        const { role } = req.body;
        const member = await DocuWorkspaceMember.findOne({ _id: req.params.memberId, workspace_id: req.user.workspaceId });
        if (!member) return res.status(404).json({ message: 'Team member not found' });
        if (member.role === 'owner') return res.status(400).json({ message: 'Cannot change owner role' });

        member.role = role;
        const saved = await member.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 10. SETTINGS
// ==========================================

router.get('/settings', authenticateDocuToken, async (req, res) => {
    try {
        const ws = await DocuWorkspace.findById(req.user.workspaceId);
        res.json(ws);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/settings', requireAdminPermission, async (req, res) => {
    try {
        const { name, brand_color, logo_url } = req.body;
        const ws = await DocuWorkspace.findById(req.user.workspaceId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        if (name) ws.name = name;
        if (brand_color) ws.brand_color = brand_color;
        if (logo_url !== undefined) ws.logo_url = logo_url;

        const saved = await ws.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 11. AUDIT LOGS
// ==========================================

router.get('/audit-logs', authenticateDocuToken, async (req, res) => {
    try {
        const logs = await DocuAuditLogNew.find({ workspace_id: req.user.workspaceId })
            .sort({ createdAt: -1 })
            .populate('document_id', 'document_name')
            .populate('user_id', 'full_name');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/documents/:id/audit-logs', authenticateDocuToken, async (req, res) => {
    try {
        const logs = await DocuAuditLogNew.find({ document_id: req.params.id })
            .sort({ createdAt: -1 })
            .populate('user_id', 'full_name');
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 12. NOTIFICATIONS
// ==========================================

router.get('/notifications', authenticateDocuToken, async (req, res) => {
    try {
        const list = await DocuNotification.find({ user_id: req.user.id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/notifications/:id/read', authenticateDocuToken, async (req, res) => {
    try {
        const notif = await DocuNotification.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user.id },
            { read_at: new Date() },
            { new: true }
        );
        res.json(notif);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/notifications/read-all', authenticateDocuToken, async (req, res) => {
    try {
        await DocuNotification.updateMany(
            { user_id: req.user.id, read_at: null },
            { read_at: new Date() }
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /public/cookie-consent - Log cookie consent preferences to a file
router.post('/public/cookie-consent', async (req, res) => {
    try {
        const { consent, email } = req.body;
        if (!consent) {
            return res.status(400).json({ message: 'Consent decision is required' });
        }

        const ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const timestamp = new Date().toISOString();

        const logLine = `[${timestamp}] IP: ${ip} | User: ${email || 'Anonymous'} | Choice: ${consent} | UA: ${userAgent}\n`;

        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const logFilePath = path.join(logsDir, 'cookie_consent_log.txt');
        fs.appendFileSync(logFilePath, logLine);

        res.json({ message: 'Consent logged successfully' });
    } catch (err) {
        console.error('Failed to log cookie consent:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;

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
const DocuJoinRequest = require('../models/DocuJoinRequest');
const DocuInvite = require('../models/DocuInvite');
const DocuSubscription = require('../models/DocuSubscription');
const DocuUsageCounter = require('../models/DocuUsageCounter');
const DocuWebForm = require('../models/DocuWebForm');
const DocuFingerprintDevice = require('../models/DocuFingerprintDevice');

// Services
const { compileFinalPdfNew, getFilePathFromUrl, calculateHash, generateAuditReportPdf } = require('../services/docuServiceNew');

// Stripe SDK Initialization
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// SMTP email config
const nodemailer = require('nodemailer');
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'fukhalfliscbbuoa'
    }
});

const originalSendMail = emailTransporter.sendMail.bind(emailTransporter);
emailTransporter.sendMail = async function(mailOptions, callback) {
    const DocuEmailLog = require('../models/DocuEmailLog');
    const workspaceId = mailOptions.workspaceId || null;
    const documentId = mailOptions.documentId || null;
    const recipientEmail = Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to;
    const subject = mailOptions.subject || '';
    const emailType = mailOptions.emailType || 'GENERIC';

    let logStatus = 'SENT';
    let errorMessage = '';
    let messageId = '';

    try {
        if (callback) {
            return originalSendMail(mailOptions, async (err, result) => {
                if (err) {
                    logStatus = 'FAILED';
                    errorMessage = err.message;
                } else {
                    messageId = result?.messageId || '';
                }
                try {
                    await new DocuEmailLog({
                        workspace_id: workspaceId,
                        document_id: documentId,
                        recipient_email: recipientEmail,
                        email_type: emailType,
                        subject,
                        status: logStatus,
                        provider_message_id: messageId,
                        error_message: errorMessage
                    }).save();
                } catch (saveErr) {
                    console.error('Failed to save email log:', saveErr);
                }
                callback(err, result);
            });
        } else {
            const result = await originalSendMail(mailOptions);
            messageId = result?.messageId || '';
            try {
                await new DocuEmailLog({
                    workspace_id: workspaceId,
                    document_id: documentId,
                    recipient_email: recipientEmail,
                    email_type: emailType,
                    subject,
                    status: 'SENT',
                    provider_message_id: messageId
                }).save();
            } catch (saveErr) {
                console.error('Failed to save email log:', saveErr);
            }
            return result;
        }
    } catch (err) {
        logStatus = 'FAILED';
        errorMessage = err.message;
        try {
            await new DocuEmailLog({
                workspace_id: workspaceId,
                document_id: documentId,
                recipient_email: recipientEmail,
                email_type: emailType,
                subject,
                status: 'FAILED',
                error_message: errorMessage
            }).save();
        } catch (saveErr) {
            console.error('Failed to save email log:', saveErr);
        }
        throw err;
    }
};

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

const triggerWebhooks = async (workspaceId, eventType, documentId) => {
    try {
        const DocuWebhook = require('../models/DocuWebhook');
        const DocuWebhookDelivery = require('../models/DocuWebhookDelivery');
        const DocuDocumentNew = require('../models/DocuDocumentNew');

        const hooks = await DocuWebhook.find({ workspace_id: workspaceId, is_active: true, events: eventType });
        if (!hooks || hooks.length === 0) return;

        const doc = await DocuDocumentNew.findById(documentId);
        if (!doc) return;

        const payload = {
            event: eventType,
            timestamp: new Date(),
            data: {
                document_id: doc._id,
                document_name: doc.document_name,
                status: doc.status,
                recipients: doc.recipients.map(r => ({
                    name: r.name,
                    email: r.email,
                    role: r.role,
                    status: r.status,
                    viewed_at: r.viewed_at,
                    signed_at: r.signed_at
                }))
            }
        };

        const axios = require('axios');
        for (const hook of hooks) {
            let statusCode = 0;
            let responseBody = '';
            let errorMsg = '';
            const start = Date.now();

            try {
                const response = await axios.post(hook.url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-BritSync-Signature': crypto.createHmac('sha256', hook.secret_token || 'secret').update(JSON.stringify(payload)).digest('hex')
                    },
                    timeout: 5000
                });
                statusCode = response.status;
                responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            } catch (err) {
                statusCode = err.response?.status || 0;
                errorMsg = err.message;
                responseBody = typeof err.response?.data === 'string' ? err.response.data : JSON.stringify(err.response?.data || '');
            }

            await new DocuWebhookDelivery({
                webhook_id: hook._id,
                event_type: eventType,
                payload_json: JSON.stringify(payload),
                response_status: statusCode,
                response_body: responseBody.substring(0, 1000),
                error_message: errorMsg,
                duration_ms: Date.now() - start
            }).save();
        }
    } catch (err) {
        console.error('Webhook trigger fail:', err);
    }
};

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

        if (workspace_id && document_id) {
            triggerWebhooks(workspace_id, event_type, document_id).catch(e => console.error('Webhook execution failed:', e));
        }
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

const PLAN_LIMITS = {
    free: {
        documents_sent: 7,
        team_members: 1,
        templates: 1,
        custom_branding: false,
        bulk_send: false,
        signer_auth: false,
        domain_join: false
    },
    pro: {
        documents_sent: 100,
        team_members: 5,
        templates: 9999,
        custom_branding: true,
        bulk_send: false,
        signer_auth: false,
        domain_join: false
    },
    business: {
        documents_sent: 1000,
        team_members: 50,
        templates: 9999,
        custom_branding: true,
        bulk_send: true,
        signer_auth: true,
        domain_join: true
    },
    enterprise: {
        documents_sent: 999999,
        team_members: 999999,
        templates: 9999,
        custom_branding: true,
        bulk_send: true,
        signer_auth: true,
        domain_join: true
    }
};

const getActiveUsageCounter = async (workspaceId) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let counter = await DocuUsageCounter.findOne({ workspace_id: workspaceId, period_start: start });
    if (!counter) {
        try {
            counter = await new DocuUsageCounter({
                workspace_id: workspaceId,
                period_start: start,
                period_end: end,
                documents_sent: 0,
                documents_completed: 0,
                templates_created: 0,
                bulk_sends: 0,
                storage_used_mb: 0,
                signer_auth_count: 0
            }).save();
        } catch (err) {
            counter = await DocuUsageCounter.findOne({ workspace_id: workspaceId, period_start: start });
        }
    }
    return counter;
};

const checkFeatureGate = (feature) => {
    return [authenticateDocuToken, fetchUserRole, async (req, res, next) => {
        try {
            const ws = await DocuWorkspace.findById(req.user.workspaceId);
            if (!ws) return res.status(404).json({ message: 'Workspace not found' });
            
            const plan = ws.plan || 'free';
            const limits = PLAN_LIMITS[plan];
            
            if (!limits || limits[feature] === false) {
                return res.status(403).json({ 
                    message: `The feature "${feature.replace(/_/g, ' ')}" is locked on your ${plan} plan. Please upgrade to unlock it.`,
                    gate_locked: true,
                    required_plan: plan === 'free' ? 'pro' : 'business'
                });
            }
            next();
    } catch (err) {
        console.error('Fingerprint login error:', err);
        res.status(500).json({ message: 'Fingerprint login failed. Please try again.' });
    }
    }];
};

const requireRole = (allowedRoles) => {
    return [authenticateDocuToken, fetchUserRole, (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: `Access denied. Role "${req.user.role}" does not have permission to perform this action.` });
        }
        next();
    }];
};

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

router.post('/auth/signup', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;
        if (!full_name || !email || !password) {
            return res.status(400).json({ message: 'Full name, email, and password are required' });
        }

        let user = await DocuUser.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        user = new DocuUser({
            full_name,
            email,
            password_hash,
            email_verified: true,
            onboarding_completed: false
        });
        const savedUser = await user.save();

        // Create Default Personal Free Workspace
        const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const workspace = new DocuWorkspace({
            name: `${full_name}'s Personal Workspace`,
            owner_id: savedUser._id,
            workspace_type: 'PERSONAL',
            workspace_code: wsCode,
            slug: `ws-${wsCode.toLowerCase()}`,
            plan: 'free',
            subscription_status: 'active'
        });
        const savedWs = await workspace.save();

        // Add Membership as joined owner
        const membership = new DocuWorkspaceMember({
            workspace_id: savedWs._id,
            user_id: savedUser._id,
            role: 'owner',
            status: 'joined',
            joined_at: new Date()
        });
        await membership.save();

        // Update user fields
        savedUser.personal_workspace_id = savedWs._id;
        savedUser.default_workspace_id = savedWs._id;
        await savedUser.save();

        // Generate Token
        const token = jwt.sign(
            { id: savedUser._id, email: savedUser.email, workspaceId: savedWs._id },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        await logAuditEvent({
            workspace_id: savedWs._id,
            user_id: savedUser._id,
            event_type: 'USER_SIGNED_UP',
            metadata: { email: savedUser.email }
        });

        res.status(201).json({ 
            token, 
            user: { id: savedUser._id, full_name: savedUser.full_name, email: savedUser.email, onboarding_completed: false }, 
            workspace: savedWs, 
            role: 'owner' 
        });
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

        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            user.failed_login_count = (user.failed_login_count || 0) + 1;
            await user.save();
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Reset failed logins and update login logs
        user.failed_login_count = 0;
        user.last_login_at = new Date();
        user.last_login_ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown';
        await user.save();

        // Find default workspace or first joined workspace
        let wsId = user.default_workspace_id;
        let member = null;
        if (wsId) {
            member = await DocuWorkspaceMember.findOne({ user_id: user._id, workspace_id: wsId, status: 'joined' }).populate('workspace_id');
        }
        if (!member) {
            member = await DocuWorkspaceMember.findOne({ user_id: user._id, status: 'joined' }).populate('workspace_id');
        }
        if (!member) {
            return res.status(400).json({ message: 'No active workspaces associated with this user' });
        }

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

        res.json({ 
            token, 
            user: { id: user._id, full_name: user.full_name, email: user.email, onboarding_completed: user.onboarding_completed }, 
            workspace: member.workspace_id, 
            role: member.role 
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/auth/me', authenticateDocuToken, async (req, res) => {
    try {
        const user = await DocuUser.findById(req.user.id).select('-password_hash');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const memberships = await DocuWorkspaceMember.find({ user_id: user._id, status: 'joined' }).populate('workspace_id');
        const activeMembership = memberships.find(m => m.workspace_id._id.toString() === req.user.workspaceId) || memberships[0];
        
        // Find any pending join requests of the user
        const pendingRequests = await DocuJoinRequest.find({ user_id: user._id, status: 'pending' }).populate('workspace_id');

        res.json({
            user,
            workspace: activeMembership ? activeMembership.workspace_id : null,
            workspaces: memberships.map(m => m.workspace_id),
            role: activeMembership ? activeMembership.role : 'member',
            pendingRequests
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/auth/switch-workspace', authenticateDocuToken, async (req, res) => {
    try {
        const { workspaceId } = req.body;
        if (!workspaceId) return res.status(400).json({ message: 'Workspace ID is required' });

        const membership = await DocuWorkspaceMember.findOne({ 
            workspace_id: workspaceId, 
            user_id: req.user.id, 
            status: 'joined' 
        }).populate('workspace_id');

        if (!membership) {
            return res.status(403).json({ message: 'You are not an active member of this workspace' });
        }

        // Set default workspace to switcher choice
        await DocuUser.findByIdAndUpdate(req.user.id, { default_workspace_id: workspaceId });

        const token = jwt.sign(
            { id: req.user.id, email: req.user.email, workspaceId },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        res.json({ 
            token, 
            workspace: membership.workspace_id, 
            role: membership.role 
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/onboarding/complete', authenticateDocuToken, async (req, res) => {
    try {
        const { choice, company_name, workspace_code } = req.body;
        const user = await DocuUser.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (choice === 'personal') {
            user.onboarding_completed = true;
            await user.save();
            return res.json({ message: 'Onboarding completed successfully', user });
        }

        if (choice === 'create-company') {
            if (!company_name) return res.status(400).json({ message: 'Company name is required' });

            const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            const workspace = new DocuWorkspace({
                name: company_name,
                owner_id: user._id,
                workspace_type: 'COMPANY',
                workspace_code: wsCode,
                slug: company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                plan: 'free',
                subscription_status: 'active'
            });
            if (!workspace.slug) workspace.slug = `ws-${wsCode.toLowerCase()}`;
            const savedWs = await workspace.save();

            const membership = new DocuWorkspaceMember({
                workspace_id: savedWs._id,
                user_id: user._id,
                role: 'owner',
                status: 'joined',
                joined_at: new Date()
            });
            await membership.save();

            user.onboarding_completed = true;
            user.default_workspace_id = savedWs._id;
            await user.save();

            const token = jwt.sign(
                { id: user._id, email: user.email, workspaceId: savedWs._id },
                process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
                { expiresIn: '7d' }
            );

            return res.json({ 
                message: 'Company workspace created', 
                token, 
                workspace: savedWs, 
                role: 'owner' 
            });
        }

        if (choice === 'join-company') {
            if (!workspace_code) return res.status(400).json({ message: 'Workspace code or company name is required' });

            // Search by workspace code first, then by company name
            let targetWs = await DocuWorkspace.findOne({ workspace_code: workspace_code.toUpperCase() });
            if (!targetWs) {
                targetWs = await DocuWorkspace.findOne({ name: { $regex: new RegExp(workspace_code, 'i') } });
            }

            if (!targetWs) {
                return res.status(404).json({ message: 'Company workspace not found. You can create a new company workspace instead.' });
            }

            // Check if already a member
            const existingMember = await DocuWorkspaceMember.findOne({ workspace_id: targetWs._id, user_id: user._id });
            if (existingMember && existingMember.status === 'joined') {
                return res.status(400).json({ message: 'You are already an active member of this company' });
            }

            // Check if request already pending
            const existingReq = await DocuJoinRequest.findOne({ workspace_id: targetWs._id, user_id: user._id, status: 'pending' });
            if (existingReq) {
                user.onboarding_completed = true;
                await user.save();
                return res.json({ message: 'Join request already submitted. Remaining pending.', request: existingReq });
            }

            // Create new join request
            const request = new DocuJoinRequest({
                workspace_id: targetWs._id,
                user_id: user._id,
                requester_name: user.full_name,
                requester_email: user.email,
                message: 'Hello, please approve my request to join this workspace.'
            });
            await request.save();

            // Notify owner via email (non-blocking)
            const owner = await DocuUser.findById(targetWs.owner_id);
            if (owner) {
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h2>New request to join ${targetWs.name}</h2>
                        <p><strong>${user.full_name}</strong> (${user.email}) has requested to join your BritSync Docu workspace.</p>
                        <p>Review the request in your Team Management panel on BritSync Docu.</p>
                    </div>
                `;
                emailTransporter.sendMail({
                    from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
                    to: owner.email,
                    subject: `New request to join ${targetWs.name}`,
                    html: emailHtml
                }).catch(e => console.error('Failed to notify owner of join request:', e));
            }

            user.onboarding_completed = true;
            await user.save();

            return res.json({ 
                message: 'Request submitted successfully. Onboarding completed.', 
                request 
            });
        }

        res.status(400).json({ message: 'Invalid onboarding choice' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/onboarding/verify-checkout', authenticateDocuToken, async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id) return res.status(400).json({ message: 'Session ID is required' });

        const stripeSecret = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecret || !stripe) {
            return res.json({ success: true, message: 'Simulated checkout success' });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ message: 'Checkout session is unpaid' });
        }

        const companyName = session.metadata.company_name;
        const userId = session.metadata.user_id;
        const plan = session.metadata.plan || 'pro';

        if (userId !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized session' });
        }

        // Provision workspace if not already done
        let workspace = await DocuWorkspace.findOne({ owner_id: userId, name: companyName });
        if (!workspace) {
            const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            workspace = new DocuWorkspace({
                name: companyName,
                owner_id: userId,
                workspace_type: 'COMPANY',
                workspace_code: wsCode,
                slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                plan: plan,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                subscription_status: 'active',
                current_period_start: new Date(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            if (!workspace.slug) workspace.slug = `ws-${wsCode.toLowerCase()}`;
            const savedWs = await workspace.save();

            await new DocuWorkspaceMember({
                workspace_id: savedWs._id,
                user_id: userId,
                role: 'owner',
                status: 'joined',
                joined_at: new Date()
            }).save();

            await DocuSubscription.findOneAndUpdate(
                { workspace_id: savedWs._id },
                {
                    stripe_customer_id: session.customer,
                    stripe_subscription_id: session.subscription,
                    plan,
                    status: 'active',
                    current_period_start: workspace.current_period_start,
                    current_period_end: workspace.current_period_end
                },
                { upsert: true }
            );

            await DocuUser.findByIdAndUpdate(userId, {
                onboarding_completed: true,
                default_workspace_id: savedWs._id
            });
        }

        const token = jwt.sign(
            { id: req.user.id, email: req.user.email, workspaceId: workspace._id },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        res.json({ success: true, token, workspace });
    } catch (err) {
        console.error('Verify checkout failed:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/auth/logout', authenticateDocuToken, async (req, res) => {
    res.json({ message: 'Logout successful' });
});

// ==========================================
// SAAS INVITES ENDPOINTS
// ==========================================

router.post('/workspaces/:id/invites', requireAdminPermission, async (req, res) => {
    try {
        const { default_role, require_approval, max_uses, expires_at } = req.body;
        const workspaceId = req.params.id;

        if (req.user.workspaceId !== workspaceId) {
            return res.status(403).json({ message: 'Unauthorized workspace selection' });
        }

        const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const invite = new DocuInvite({
            workspace_id: workspaceId,
            invite_code: inviteCode,
            created_by: req.user.id,
            default_role: default_role || 'sender',
            require_approval: !!require_approval,
            max_uses: parseInt(max_uses) || 0,
            expires_at: expires_at ? new Date(expires_at) : undefined,
            status: 'active'
        });

        const savedInvite = await invite.save();

        await logAuditEvent({
            workspace_id: workspaceId,
            user_id: req.user.id,
            event_type: 'INVITE_LINK_CREATED',
            metadata: { invite_code: inviteCode, default_role }
        });

        res.status(201).json(savedInvite);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/workspaces/:id/invites', requireAdminPermission, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        if (req.user.workspaceId !== workspaceId) {
            return res.status(403).json({ message: 'Unauthorized workspace selection' });
        }

        const invites = await DocuInvite.find({ workspace_id: workspaceId }).sort({ createdAt: -1 });
        res.json(invites);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/workspaces/:id/invites/:inviteId', requireAdminPermission, async (req, res) => {
    try {
        const { status } = req.body;
        const workspaceId = req.params.id;
        if (req.user.workspaceId !== workspaceId) {
            return res.status(403).json({ message: 'Unauthorized workspace selection' });
        }

        const invite = await DocuInvite.findOne({ _id: req.params.inviteId, workspace_id: workspaceId });
        if (!invite) return res.status(404).json({ message: 'Invite link not found' });

        if (status) invite.status = status;
        const saved = await invite.save();

        await logAuditEvent({
            workspace_id: workspaceId,
            user_id: req.user.id,
            event_type: 'INVITE_LINK_STATUS_UPDATED',
            metadata: { invite_code: invite.invite_code, status }
        });

        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/join/:inviteCode', authenticateDocuToken, async (req, res) => {
    try {
        const { inviteCode } = req.params;
        const invite = await DocuInvite.findOne({ invite_code: inviteCode });
        if (!invite) return res.status(404).json({ message: 'Invalid or deactivated invite link' });

        if (invite.status !== 'active') {
            return res.status(400).json({ message: 'This invite link is no longer active' });
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            invite.status = 'expired';
            await invite.save();
            return res.status(400).json({ message: 'This invite link has expired' });
        }

        if (invite.max_uses > 0 && invite.used_count >= invite.max_uses) {
            return res.status(400).json({ message: 'This invite link has reached its maximum uses' });
        }

        const existingMember = await DocuWorkspaceMember.findOne({
            workspace_id: invite.workspace_id,
            user_id: req.user.id,
            status: 'joined'
        });
        if (existingMember) {
            return res.status(400).json({ message: 'You are already a member of this workspace' });
        }

        if (invite.require_approval) {
            const existingReq = await DocuJoinRequest.findOne({
                workspace_id: invite.workspace_id,
                user_id: req.user.id,
                status: 'pending'
            });

            if (existingReq) {
                return res.json({ status: 'pending_approval', message: 'A join request is already pending approval from the administrator.' });
            }

            const joinReq = new DocuJoinRequest({
                workspace_id: invite.workspace_id,
                user_id: req.user.id,
                requester_name: req.user.email,
                requester_email: req.user.email,
                message: 'Joined using invite link code ' + inviteCode
            });
            await joinReq.save();

            return res.json({ status: 'pending_approval', message: 'A join request has been submitted to the workspace administrator for approval.' });
        } else {
            const member = new DocuWorkspaceMember({
                workspace_id: invite.workspace_id,
                user_id: req.user.id,
                role: invite.default_role || 'sender',
                status: 'joined',
                joined_at: new Date()
            });
            await member.save();

            invite.used_count += 1;
            await invite.save();

            await DocuUser.findByIdAndUpdate(req.user.id, {
                default_workspace_id: invite.workspace_id,
                onboarding_completed: true
            });

            await logAuditEvent({
                workspace_id: invite.workspace_id,
                user_id: req.user.id,
                event_type: 'USER_JOINED_VIA_INVITE',
                metadata: { invite_code: inviteCode, role: invite.default_role }
            });

            return res.json({ status: 'joined', message: 'Successfully joined the workspace!' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/workspaces/join-by-code', authenticateDocuToken, async (req, res) => {
    try {
        const { workspace_code } = req.body;
        if (!workspace_code) return res.status(400).json({ message: 'Workspace code is required' });

        const workspace = await DocuWorkspace.findOne({ workspace_code });
        if (!workspace) return res.status(404).json({ message: 'Workspace not found with the provided code' });

        const existingMember = await DocuWorkspaceMember.findOne({
            workspace_id: workspace._id,
            user_id: req.user.id,
            status: 'joined'
        });
        if (existingMember) {
            return res.status(400).json({ message: 'You are already a member of this workspace' });
        }

        if (workspace.require_approval_for_join) {
            const existingReq = await DocuJoinRequest.findOne({
                workspace_id: workspace._id,
                user_id: req.user.id,
                status: 'pending'
            });

            if (existingReq) {
                return res.json({ status: 'pending_approval', message: 'A join request is already pending approval from the administrator.' });
            }

            const joinReq = new DocuJoinRequest({
                workspace_id: workspace._id,
                user_id: req.user.id,
                requester_name: req.user.email,
                requester_email: req.user.email,
                message: 'Requested join via workspace code ' + workspace_code
            });
            await joinReq.save();

            return res.json({ status: 'pending_approval', message: 'A join request has been submitted to the workspace administrator for approval.' });
        } else {
            const member = new DocuWorkspaceMember({
                workspace_id: workspace._id,
                user_id: req.user.id,
                role: 'viewer',
                status: 'joined',
                joined_at: new Date()
            });
            await member.save();

            await DocuUser.findByIdAndUpdate(req.user.id, {
                default_workspace_id: workspace._id,
                onboarding_completed: true
            });

            await logAuditEvent({
                workspace_id: workspace._id,
                user_id: req.user.id,
                event_type: 'USER_JOINED_VIA_CODE',
                metadata: { workspace_code }
            });

            return res.json({ status: 'joined', message: 'Successfully joined the workspace!' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// SAAS DOMAIN DISCOVERY ENDPOINTS
// ==========================================

router.get('/workspaces/domain-suggestions', authenticateDocuToken, async (req, res) => {
    try {
        const email = req.user.email;
        const parts = email.split('@');
        if (parts.length < 2) return res.json([]);
        const domain = parts[1].toLowerCase().trim();

        const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'zoho.com', 'protonmail.com', 'yandex.com', 'mail.com'];
        if (genericDomains.includes(domain)) {
            return res.json([]);
        }

        const workspaces = await DocuWorkspace.find({
            domain: domain,
            domain_join_enabled: true
        }).select('name domain require_approval_for_join auto_approve_domain_users default_role_for_domain_users plan');

        res.json(workspaces);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/workspaces/request-domain-join', authenticateDocuToken, async (req, res) => {
    try {
        const { workspace_id } = req.body;
        if (!workspace_id) return res.status(400).json({ message: 'Workspace ID is required' });

        const workspace = await DocuWorkspace.findById(workspace_id);
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const email = req.user.email;
        const userDomain = email.split('@')[1]?.toLowerCase().trim();
        if (workspace.domain !== userDomain || !workspace.domain_join_enabled) {
            return res.status(403).json({ message: 'Workspace domain settings do not permit join request' });
        }

        const existingMember = await DocuWorkspaceMember.findOne({
            workspace_id: workspace._id,
            user_id: req.user.id,
            status: 'joined'
        });
        if (existingMember) {
            return res.status(400).json({ message: 'You are already a member of this workspace' });
        }

        const isEligibleForAutoApprove = ['business', 'enterprise'].includes(workspace.plan);
        const autoApprove = workspace.auto_approve_domain_users && isEligibleForAutoApprove;

        if (autoApprove) {
            const member = new DocuWorkspaceMember({
                workspace_id: workspace._id,
                user_id: req.user.id,
                role: workspace.default_role_for_domain_users || 'viewer',
                status: 'joined',
                joined_at: new Date()
            });
            await member.save();

            await DocuUser.findByIdAndUpdate(req.user.id, {
                default_workspace_id: workspace._id,
                onboarding_completed: true
            });

            await logAuditEvent({
                workspace_id: workspace._id,
                user_id: req.user.id,
                event_type: 'USER_DOMAIN_AUTO_JOIN',
                metadata: { domain: userDomain }
            });

            return res.json({ status: 'joined', message: 'Successfully joined workspace via company domain auto-approval!' });
        } else {
            const existingReq = await DocuJoinRequest.findOne({
                workspace_id: workspace._id,
                user_id: req.user.id,
                status: 'pending'
            });

            if (existingReq) {
                return res.json({ status: 'pending_approval', message: 'A join request is already pending approval from the administrator.' });
            }

            const joinReq = new DocuJoinRequest({
                workspace_id: workspace._id,
                user_id: req.user.id,
                requester_name: req.user.email,
                requester_email: req.user.email,
                message: 'Requested join via company domain matching'
            });
            await joinReq.save();

            return res.json({ status: 'pending_approval', message: 'A join request has been submitted to the workspace administrator for approval.' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/workspaces/:id/domain-settings', requireAdminPermission, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        if (req.user.workspaceId !== workspaceId) {
            return res.status(403).json({ message: 'Unauthorized workspace selection' });
        }

        const workspace = await DocuWorkspace.findById(workspaceId);
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const { domain, domain_join_enabled, require_approval_for_join, auto_approve_domain_users, default_role_for_domain_users } = req.body;

        if (domain !== undefined) workspace.domain = domain.toLowerCase().trim();
        if (domain_join_enabled !== undefined) workspace.domain_join_enabled = !!domain_join_enabled;
        if (require_approval_for_join !== undefined) workspace.require_approval_for_join = !!require_approval_for_join;
        
        if (auto_approve_domain_users !== undefined) {
            if (auto_approve_domain_users && !['business', 'enterprise'].includes(workspace.plan)) {
                return res.status(403).json({ message: 'Auto-approving domain users requires a Business plan tier' });
            }
            workspace.auto_approve_domain_users = !!auto_approve_domain_users;
        }

        if (default_role_for_domain_users !== undefined) {
            workspace.default_role_for_domain_users = default_role_for_domain_users;
        }

        const saved = await workspace.save();
        res.json(saved);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// SAAS USAGE & QUOTA LIMITS ENDPOINTS
// ==========================================

router.get('/usage/current', authenticateDocuToken, async (req, res) => {
    try {
        const wsId = req.user.workspaceId;
        const ws = await DocuWorkspace.findById(wsId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const counter = await getActiveUsageCounter(wsId);
        const plan = ws.plan || 'free';
        const limits = PLAN_LIMITS[plan];

        res.json({
            used: counter.documents_sent || 0,
            limit: limits.documents_sent,
            plan: plan,
            percent: Math.min(100, Math.floor(((counter.documents_sent || 0) / limits.documents_sent) * 100))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/usage/recalculate', authenticateDocuToken, async (req, res) => {
    try {
        const wsId = req.user.workspaceId;
        const counter = await getActiveUsageCounter(wsId);
        
        const count = await DocuDocumentNew.countDocuments({
            workspace_id: wsId,
            status: { $ne: 'draft' },
            createdAt: { $gte: counter.period_start, $lte: counter.period_end }
        });

        counter.documents_sent = count;
        await counter.save();

        res.json({ success: true, counter });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// SAAS DEVELOPER WEBHOOKS ENDPOINTS
// ==========================================

router.get('/webhooks', authenticateDocuToken, fetchUserRole, async (req, res) => {
    try {
        const DocuWebhook = require('../models/DocuWebhook');
        const list = await DocuWebhook.find({ workspace_id: req.user.workspaceId });
        res.json(list || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/webhooks', authenticateDocuToken, fetchUserRole, async (req, res) => {
    try {
        const ws = await DocuWorkspace.findById(req.user.workspaceId);
        if (!ws || !['business', 'enterprise'].includes(ws.plan)) {
            return res.status(403).json({ message: 'Webhooks integration is a Business plan feature.' });
        }

        const DocuWebhook = require('../models/DocuWebhook');
        const { url, events, secret_token } = req.body;
        
        const hook = new DocuWebhook({
            workspace_id: req.user.workspaceId,
            url,
            events: events || ['DOCUMENT_COMPLETED', 'DOCUMENT_DECLINED'],
            secret_token: secret_token || crypto.randomBytes(20).toString('hex'),
            is_active: true
        });

        await hook.save();
        res.json(hook);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.patch('/webhooks/:id', authenticateDocuToken, fetchUserRole, async (req, res) => {
    try {
        const DocuWebhook = require('../models/DocuWebhook');
        const { is_active, events } = req.body;

        const hook = await DocuWebhook.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!hook) return res.status(404).json({ message: 'Webhook not found' });

        if (is_active !== undefined) hook.is_active = !!is_active;
        if (events !== undefined) hook.events = events;

        await hook.save();
        res.json(hook);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/webhooks/:id', authenticateDocuToken, fetchUserRole, async (req, res) => {
    try {
        const DocuWebhook = require('../models/DocuWebhook');
        const deleted = await DocuWebhook.findOneAndDelete({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!deleted) return res.status(404).json({ message: 'Webhook not found' });
        res.json({ success: true, message: 'Webhook deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/webhooks/logs', authenticateDocuToken, fetchUserRole, async (req, res) => {
    try {
        const DocuWebhook = require('../models/DocuWebhook');
        const DocuWebhookDelivery = require('../models/DocuWebhookDelivery');

        const hooks = await DocuWebhook.find({ workspace_id: req.user.workspaceId });
        const hookIds = hooks.map(h => h._id);

        const logs = await DocuWebhookDelivery.find({ webhook_id: { $in: hookIds } })
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(logs || []);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
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
        
        // Fetch user role in this workspace
        const member = await DocuWorkspaceMember.findOne({
            workspace_id: req.user.workspaceId,
            user_id: req.user.id,
            status: 'joined'
        });
        const role = member ? member.role : 'viewer';

        const query = { workspace_id: req.user.workspaceId };
        if (status) {
            query.status = status;
        } else {
            query.status = { $ne: 'archived' };
        }

        // Apply RBAC filtering
        if (role === 'sender') {
            query.$or = [
                { owner_id: req.user.id },
                { 'recipients.email': req.user.email }
            ];
        } else if (role === 'viewer') {
            query['recipients.email'] = req.user.email;
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

router.get('/documents/:id/file', authenticateDocuToken, async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        if (!doc.original_file_url) return res.status(404).json({ message: 'File not found' });
        const filename = doc.original_file_url.split('/uploads/')[1] || doc.original_file_url.split('/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found on disk' });
        const fileBuffer = fs.readFileSync(filePath);
        const base64 = fileBuffer.toString('base64');
        res.json({ success: true, data: base64, filename });
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
        if (fields) {
            doc.fields = fields.map((f) => {
                if (f._id && typeof f._id === 'string' && f._id.startsWith('temp-')) {
                    const { _id, ...rest } = f;
                    return rest;
                }
                return f;
            });
        }
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

        // Enforce plan limits on sent documents
        const ws = await DocuWorkspace.findById(req.user.workspaceId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const counter = await getActiveUsageCounter(ws._id);
        const plan = ws.plan || 'free';
        const limits = PLAN_LIMITS[plan];

        if (counter.documents_sent >= limits.documents_sent) {
            return res.status(403).json({
                message: `You have reached the monthly limit of ${limits.documents_sent} documents sent for the ${plan} plan. Please upgrade to send more documents.`,
                limit_reached: true
            });
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

        // Atomically increment documents_sent counter
        await DocuUsageCounter.updateOne(
            { workspace_id: req.user.workspaceId, period_start: counter.period_start },
            { $inc: { documents_sent: 1 } }
        );

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
            const signingLink = `${frontendUrl}/public/sign/${recipientToNotify.secure_token}`;
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
        const signingLink = `${frontendUrl}/public/sign/${activeSigner.secure_token}`;
        
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

        // Compute field IDs belonging to this recipient
        const myFieldIds = doc.fields
            .filter(f => {
                if (f.assigned_recipient_id === 'all') return true;
                if (String(recipient._id) === f.assigned_recipient_id) return true;
                if (recipient.secure_token === f.assigned_recipient_id) return true;
                if (recipient.name === f.assigned_recipient_id) return true;
                if (recipient.email?.toLowerCase() === f.assigned_recipient_id?.toLowerCase()) return true;
                return false;
            })
            .map(f => f._id.toString());

        // Check completion status
        if (doc.status === 'completed') {
            return res.json({ doc, recipient, state: 'completed', myFieldIds });
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
            return res.json({ doc, recipient, state: 'not_your_turn', myFieldIds });
        }

        // Enforcement of Recipient verification challenge
        if (recipient.auth_method && recipient.auth_method !== 'none' && !recipient.auth_verified_at) {
            return res.json({
                state: 'auth_required',
                auth_method: recipient.auth_method,
                recipient: { name: recipient.name, email: recipient.email }
            });
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

        // Read PDF and embed as base64 to avoid IDM interception of direct file URL
        let pdfBase64 = null;
        try {
            const filename = doc.original_file_url.split('/uploads/')[1] || doc.original_file_url.split('/').pop();
            const filePath = path.join(__dirname, '..', 'uploads', filename);
            if (fs.existsSync(filePath)) {
                pdfBase64 = fs.readFileSync(filePath).toString('base64');
            }
        } catch (pdfErr) {
            console.error('[PUBLIC_SIGN] Failed to read PDF:', pdfErr.message);
        }

        res.json({ doc, recipient, state: 'signing', myFieldIds, pdfBase64 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/public/sign/:token/decline', async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.token });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const recipient = doc.recipients.find(r => r.secure_token === req.params.token);
        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

        recipient.status = 'declined';
        doc.status = 'declined';
        
        await doc.save();

        await logAuditEvent({
            workspace_id: doc.workspace_id,
            document_id: doc._id,
            recipient_id: recipient.secure_token,
            event_type: 'DOCUMENT_DECLINED',
            ip_address: req.ip || req.headers['x-forwarded-for'],
            user_agent: req.headers['user-agent'],
            metadata: { reason: req.body.message, recipient_email: recipient.email }
        });

        res.json({ success: true, message: 'Document declined successfully.' });
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
            if (f.required) {
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
                if (f.signature_data) {
                    docField.signature_data = f.signature_data;
                    docField.value = 'Signed';
                } else if (f.value !== undefined) {
                    docField.value = f.value;
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
                const signingLink = `${frontendUrl}/public/sign/${nextSigner.secure_token}`;
                
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

const logoUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
        filename: (req, file, cb) => {
            const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            cb(null, 'logo-' + Date.now() + '-' + sanitized);
        }
    }),
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WEBP images are allowed.'), false);
        }
    },
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

router.post('/settings/logo', requireAdminPermission, logoUpload.single('logo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No logo file uploaded' });
    try {
        const logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const ws = await DocuWorkspace.findByIdAndUpdate(req.user.workspaceId, { logo_url: logoUrl }, { new: true });
        res.json({ message: 'Logo uploaded successfully', logo_url: logoUrl, workspace: ws });
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

// ==========================================
// 13. SAAS WORKSPACE MANAGEMENT & DISCOVERY
// ==========================================

router.get('/workspaces/search', authenticateDocuToken, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ message: 'Search query is required' });

        const results = await DocuWorkspace.find({
            workspace_type: 'COMPANY',
            $or: [
                { name: { $regex: new RegExp(query, 'i') } },
                { workspace_code: query.toUpperCase() },
                { domain: query.toLowerCase() }
            ]
        }).select('name logo_url workspace_type workspace_code domain');

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/workspaces/pending-requests', authenticateDocuToken, async (req, res) => {
    try {
        const list = await DocuJoinRequest.find({ user_id: req.user.id, status: 'pending' }).populate('workspace_id', 'name logo_url');
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/workspaces/join-request/:id', authenticateDocuToken, async (req, res) => {
    try {
        const request = await DocuJoinRequest.findOneAndDelete({ _id: req.params.id, user_id: req.user.id, status: 'pending' });
        if (!request) return res.status(404).json({ message: 'Pending request not found' });
        res.json({ message: 'Request successfully withdrawn' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/workspaces/:id/admin/join-requests', requireAdminPermission, async (req, res) => {
    try {
        const list = await DocuJoinRequest.find({ workspace_id: req.params.id, status: 'pending' }).populate('user_id', 'full_name email');
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/workspaces/:id/admin/join-requests/:requestId/resolve', requireAdminPermission, async (req, res) => {
    try {
        const { action, role } = req.body; // action: 'approve' | 'reject'
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action. Must be approve or reject.' });
        }

        const request = await DocuJoinRequest.findOne({ _id: req.params.requestId, workspace_id: req.params.id, status: 'pending' });
        if (!request) return res.status(404).json({ message: 'Join request not found' });

        if (action === 'approve') {
            request.status = 'approved';
            request.reviewed_by = req.user.id;
            request.reviewed_at = new Date();
            await request.save();

            // Create workspace membership
            const targetRole = role || 'sender';
            const membership = new DocuWorkspaceMember({
                workspace_id: req.params.id,
                user_id: request.user_id,
                role: targetRole,
                status: 'joined',
                joined_at: new Date()
            });
            await membership.save();

            // Set as user default workspace
            await DocuUser.findByIdAndUpdate(request.user_id, { default_workspace_id: req.params.id });

            // Notify user via email
            const targetUser = await DocuUser.findById(request.user_id);
            const ws = await DocuWorkspace.findById(req.params.id);
            if (targetUser && ws) {
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h2>Request Approved!</h2>
                        <p>Your request to join the workspace <strong>${ws.name}</strong> has been approved.</p>
                        <p>You can now switch to this workspace from your dashboard.</p>
                    </div>
                `;
                emailTransporter.sendMail({
                    from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
                    to: targetUser.email,
                    subject: `Approved: Request to join ${ws.name}`,
                    html: emailHtml
                }).catch(e => console.error('Failed to send approval email:', e));
            }
        } else {
            request.status = 'rejected';
            request.reviewed_by = req.user.id;
            request.reviewed_at = new Date();
            await request.save();
        }

        res.json({ message: `Request successfully ${action}d` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 14. INVITE LINK MANAGEMENT
// ==========================================

router.get('/workspaces/:id/invites', requireAdminPermission, async (req, res) => {
    try {
        const list = await DocuInvite.find({ workspace_id: req.params.id, status: 'active' });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/workspaces/:id/invites', requireAdminPermission, async (req, res) => {
    try {
        const { default_role, max_uses, expires_in_days } = req.body;
        
        // Enforce team members size limit on invites if Free/Pro
        const ws = await DocuWorkspace.findById(req.params.id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const currentMembers = await DocuWorkspaceMember.countDocuments({ workspace_id: ws._id, status: 'joined' });
        const limits = PLAN_LIMITS[ws.plan || 'free'];
        if (currentMembers >= limits.team_members) {
            return res.status(403).json({ 
                message: `You have reached the maximum of ${limits.team_members} team members allowed on the ${ws.plan} plan. Please upgrade to invite more members.` 
            });
        }

        const inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();
        const expires_at = expires_in_days ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000) : null;

        const invite = new DocuInvite({
            workspace_id: req.params.id,
            invite_code: inviteCode,
            created_by: req.user.id,
            default_role: default_role || 'sender',
            max_uses: max_uses || 0,
            expires_at
        });

        await invite.save();
        res.status(201).json(invite);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/workspaces/join-invite/:inviteCode', authenticateDocuToken, async (req, res) => {
    try {
        const invite = await DocuInvite.findOne({ invite_code: req.params.inviteCode.toUpperCase(), status: 'active' });
        if (!invite) return res.status(404).json({ message: 'Active invite link not found or expired.' });

        if (invite.expires_at && new Date() > invite.expires_at) {
            invite.status = 'expired';
            await invite.save();
            return res.status(400).json({ message: 'This invite link has expired.' });
        }

        if (invite.max_uses > 0 && invite.used_count >= invite.max_uses) {
            return res.status(400).json({ message: 'This invite link has reached its maximum uses.' });
        }

        // Check if already a member
        const existingMember = await DocuWorkspaceMember.findOne({ workspace_id: invite.workspace_id, user_id: req.user.id });
        if (existingMember && existingMember.status === 'joined') {
            return res.status(400).json({ message: 'You are already an active member of this workspace' });
        }

        // Enforce plan limits
        const ws = await DocuWorkspace.findById(invite.workspace_id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const currentMembers = await DocuWorkspaceMember.countDocuments({ workspace_id: ws._id, status: 'joined' });
        const limits = PLAN_LIMITS[ws.plan || 'free'];
        if (currentMembers >= limits.team_members) {
            return res.status(403).json({ 
                message: `This workspace has reached its member limit for the ${ws.plan} plan.` 
            });
        }

        // Join
        const membership = new DocuWorkspaceMember({
            workspace_id: invite.workspace_id,
            user_id: req.user.id,
            role: invite.default_role,
            status: 'joined',
            joined_at: new Date()
        });
        await membership.save();

        invite.used_count += 1;
        await invite.save();

        // Switch to the joined workspace
        await DocuUser.findByIdAndUpdate(req.user.id, { default_workspace_id: invite.workspace_id });

        res.json({ message: 'Successfully joined workspace via invite code!', workspace: ws });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 15. LEAVE & OWNERSHIP TRANSFER
// ==========================================

router.post('/workspaces/:id/leave', authenticateDocuToken, async (req, res) => {
    try {
        const wsId = req.params.id;
        const membership = await DocuWorkspaceMember.findOne({ workspace_id: wsId, user_id: req.user.id, status: 'joined' });
        if (!membership) {
            return res.status(404).json({ message: 'Workspace membership not found' });
        }

        if (membership.role === 'owner') {
            const otherOwnersCount = await DocuWorkspaceMember.countDocuments({
                workspace_id: wsId,
                role: 'owner',
                status: 'joined',
                user_id: { $ne: req.user.id }
            });
            if (otherOwnersCount === 0) {
                return res.status(400).json({ 
                    message: 'You are the sole owner of this workspace. You cannot leave unless you transfer ownership to another member or delete the workspace entirely.' 
                });
            }
        }

        membership.status = 'left';
        membership.left_at = new Date();
        await membership.save();

        res.json({ message: 'Successfully left the workspace' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/workspaces/:id/transfer-ownership', authenticateDocuToken, fetchUserRole, async (req, res) => {
    try {
        if (req.user.role !== 'owner') {
            return res.status(403).json({ message: 'Only the workspace owner can transfer ownership' });
        }

        const { targetUserId } = req.body;
        if (!targetUserId) return res.status(400).json({ message: 'Target user ID is required' });

        const targetMember = await DocuWorkspaceMember.findOne({
            workspace_id: req.params.id,
            user_id: targetUserId,
            status: 'joined'
        });

        if (!targetMember) {
            return res.status(400).json({ message: 'Target user is not a member of this workspace' });
        }

        targetMember.role = 'owner';
        await targetMember.save();

        await DocuWorkspaceMember.updateOne(
            { workspace_id: req.params.id, user_id: req.user.id },
            { role: 'admin' }
        );

        await DocuWorkspace.findByIdAndUpdate(req.params.id, { owner_id: targetUserId });

        await logAuditEvent({
            workspace_id: req.params.id,
            user_id: req.user.id,
            event_type: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
            metadata: { new_owner_id: targetUserId }
        });

        res.json({ message: 'Workspace ownership successfully transferred' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ==========================================
// 16. STRIPE BILLING & INTEGRATION
// ==========================================

const isDev = process.env.NODE_ENV !== 'production';

router.post('/billing/create-checkout-session', authenticateDocuToken, async (req, res) => {
    try {
        const { plan, interval, action, company_name } = req.body; // plan: 'pro' | 'business', interval: 'monthly' | 'yearly'
        const stripeSecret = process.env.STRIPE_SECRET_KEY;

        if (action === 'create_company') {
            if (!company_name || !company_name.trim()) {
                return res.status(400).json({ message: 'Company name is required for creating a company workspace' });
            }

            // Local development simulation
            if (!stripeSecret || !stripe) {
                if (isDev) {
                    const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
                    const workspace = new DocuWorkspace({
                        name: company_name,
                        owner_id: req.user.id,
                        workspace_type: 'COMPANY',
                        workspace_code: wsCode,
                        slug: company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                        plan: plan || 'pro',
                        subscription_status: 'active',
                        current_period_start: new Date(),
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    });
                    if (!workspace.slug) workspace.slug = `ws-${wsCode.toLowerCase()}`;
                    const savedWs = await workspace.save();

                    await new DocuWorkspaceMember({
                        workspace_id: savedWs._id,
                        user_id: req.user.id,
                        role: 'owner',
                        status: 'joined',
                        joined_at: new Date()
                    }).save();

                    await DocuSubscription.findOneAndUpdate(
                        { workspace_id: savedWs._id },
                        {
                            stripe_customer_id: 'mock_cust_123',
                            stripe_subscription_id: 'mock_sub_123',
                            plan: plan || 'pro',
                            status: 'active',
                            price_id: 'mock_price_123',
                            current_period_start: new Date(),
                            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        },
                        { upsert: true }
                    );

                    await DocuUser.findByIdAndUpdate(req.user.id, {
                        onboarding_completed: true,
                        default_workspace_id: savedWs._id
                    });

                    return res.json({ 
                        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/onboarding?checkout_success=true&simulated=true`,
                        simulated: true 
                    });
                } else {
                    return res.status(500).json({ 
                        message: 'Stripe integration is not configured on the production server. Checkout is disabled.' 
                    });
                }
            }

            const unitAmount = plan === 'business' ? 100 : 50; // 1 INR vs 0.50 INR (50 paise is Stripe minimum for INR)
            const planDesc = plan === 'business' 
                ? 'Up to 50 team members, 500 documents per month, bulk send & signer auth.' 
                : 'Up to 5 team members, 50 documents per month, templates & custom branding.';

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: `BritSync Docu ${plan === 'business' ? 'Business' : 'Pro'} Company Plan`,
                            description: planDesc
                        },
                        unit_amount: unitAmount,
                        recurring: { interval: 'month' }
                    },
                    quantity: 1
                }],
                mode: 'subscription',
                billing_address_collection: 'required',
                success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/onboarding?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/onboarding?canceled=true`,
                customer_email: req.user.email,
                metadata: {
                    action: 'create_company',
                    company_name,
                    user_id: req.user.id,
                    plan
                }
            });

            return res.json({ url: session.url });
        }

        // Standard subscription upgrade for existing workspace
        const wsId = req.user.workspaceId;
        const ws = await DocuWorkspace.findById(wsId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        if (ws.owner_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the workspace owner can manage subscriptions' });
        }

        if (!stripeSecret || !stripe) {
            if (isDev) {
                ws.plan = plan;
                ws.subscription_status = 'active';
                ws.current_period_start = new Date();
                ws.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                await ws.save();

                await DocuSubscription.findOneAndUpdate(
                    { workspace_id: wsId },
                    {
                        stripe_customer_id: 'mock_cust_123',
                        stripe_subscription_id: 'mock_sub_123',
                        plan,
                        status: 'active',
                        price_id: 'mock_price_123',
                        current_period_start: new Date(),
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    },
                    { upsert: true }
                );

                return res.json({ 
                    url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/billing?success=true`,
                    simulated: true 
                });
            } else {
                return res.status(500).json({ 
                    message: 'Stripe integration is not configured on the production server. Checkout is disabled.' 
                });
            }
        }

        const unitAmount = plan === 'business' ? 100 : 50; // 1 INR vs 0.50 INR
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: `BritSync Docu ${plan === 'business' ? 'Business' : 'Pro'} Plan`,
                        description: `Upgrade your workspace to ${plan}`
                    },
                    unit_amount: unitAmount,
                    recurring: { interval: 'month' }
                    },
                quantity: 1
            }],
            mode: 'subscription',
            billing_address_collection: 'required',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/billing?success=true`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/billing?canceled=true`,
            client_reference_id: wsId.toString(),
            customer_email: req.user.email,
            metadata: { workspaceId: wsId.toString(), plan }
        });

        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/billing/create-portal-session', authenticateDocuToken, async (req, res) => {
    try {
        const wsId = req.user.workspaceId;
        const ws = await DocuWorkspace.findById(wsId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        if (ws.owner_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the workspace owner can manage billing portal' });
        }

        if (!ws.stripe_customer_id) {
            return res.status(400).json({ message: 'No active Stripe billing profile found for this workspace' });
        }

        const stripeSecret = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecret || !stripe) {
            if (isDev) {
                return res.json({ url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/billing` });
            } else {
                return res.status(500).json({ message: 'Stripe integration is not configured on the production server.' });
            }
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: ws.stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/docu/billing`
        });

        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/billing/current', authenticateDocuToken, async (req, res) => {
    try {
        const ws = await DocuWorkspace.findById(req.user.workspaceId);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const counter = await getActiveUsageCounter(ws._id);
        const sub = await DocuSubscription.findOne({ workspace_id: ws._id });

        res.json({
            plan: ws.plan || 'free',
            subscription_status: ws.subscription_status || 'active',
            limits: PLAN_LIMITS[ws.plan || 'free'],
            usage: counter,
            subscription: sub
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/billing/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (stripeSecret && webhookSecret && stripe) {
        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        if (isDev) {
            event = req.body;
        } else {
            return res.status(400).send('Stripe configuration missing.');
        }
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const wsId = session.client_reference_id || session.metadata.workspaceId;
                const plan = session.metadata.plan || 'pro';
                const action = session.metadata.action;
                const companyName = session.metadata.company_name;
                const userId = session.metadata.user_id;

                if (action === 'create_company' && companyName && userId) {
                    let existingWs = await DocuWorkspace.findOne({ owner_id: userId, name: companyName });
                    if (!existingWs) {
                        const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
                        const workspace = new DocuWorkspace({
                            name: companyName,
                            owner_id: userId,
                            workspace_type: 'COMPANY',
                            workspace_code: wsCode,
                            slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                            plan: plan,
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: session.subscription,
                            subscription_status: 'active'
                        });
                        if (!workspace.slug) workspace.slug = `ws-${wsCode.toLowerCase()}`;
                        
                        if (stripeSecret && stripe && session.subscription) {
                            try {
                                const sub = await stripe.subscriptions.retrieve(session.subscription);
                                workspace.current_period_start = new Date(sub.current_period_start * 1000);
                                workspace.current_period_end = new Date(sub.current_period_end * 1000);
                            } catch (e) {
                                workspace.current_period_start = new Date();
                                workspace.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                            }
                        } else {
                            workspace.current_period_start = new Date();
                            workspace.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        }
                        const savedWs = await workspace.save();

                        await new DocuWorkspaceMember({
                            workspace_id: savedWs._id,
                            user_id: userId,
                            role: 'owner',
                            status: 'joined',
                            joined_at: new Date()
                        }).save();

                        await DocuSubscription.findOneAndUpdate(
                            { workspace_id: savedWs._id },
                            {
                                stripe_customer_id: session.customer,
                                stripe_subscription_id: session.subscription,
                                plan,
                                status: 'active',
                                current_period_start: workspace.current_period_start,
                                current_period_end: workspace.current_period_end
                            },
                            { upsert: true }
                        );

                        await DocuUser.findByIdAndUpdate(userId, {
                            onboarding_completed: true,
                            default_workspace_id: savedWs._id
                        });
                    }
                } else if (wsId) {
                    const ws = await DocuWorkspace.findById(wsId);
                    if (ws) {
                        ws.plan = plan;
                        ws.stripe_customer_id = session.customer;
                        ws.stripe_subscription_id = session.subscription;
                        ws.subscription_status = 'active';
                        
                        if (stripeSecret && stripe && session.subscription) {
                            const sub = await stripe.subscriptions.retrieve(session.subscription);
                            ws.current_period_start = new Date(sub.current_period_start * 1000);
                            ws.current_period_end = new Date(sub.current_period_end * 1000);
                        } else {
                            ws.current_period_start = new Date();
                            ws.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        }
                        await ws.save();

                        await DocuSubscription.findOneAndUpdate(
                            { workspace_id: wsId },
                            {
                                stripe_customer_id: session.customer,
                                stripe_subscription_id: session.subscription,
                                plan,
                                status: 'active',
                                current_period_start: ws.current_period_start,
                                current_period_end: ws.current_period_end
                            },
                            { upsert: true }
                        );
                    }
                }
                break;
            }
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const subscription = await DocuSubscription.findOne({ stripe_subscription_id: sub.id });
                if (subscription) {
                    subscription.status = sub.status;
                    subscription.current_period_start = new Date(sub.current_period_start * 1000);
                    subscription.current_period_end = new Date(sub.current_period_end * 1000);
                    await subscription.save();

                    await DocuWorkspace.findByIdAndUpdate(subscription.workspace_id, {
                        subscription_status: sub.status,
                        current_period_start: subscription.current_period_start,
                        current_period_end: subscription.current_period_end
                    });
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const subscription = await DocuSubscription.findOne({ stripe_subscription_id: sub.id });
                if (subscription) {
                    subscription.status = 'canceled';
                    subscription.plan = 'free';
                    await subscription.save();

                    await DocuWorkspace.findByIdAndUpdate(subscription.workspace_id, {
                        plan: 'free',
                        subscription_status: 'canceled'
                    });
                }
                break;
            }
        }
        res.json({ received: true });
    } catch (err) {
        console.error('Webhook handling error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 17. ADVANCED SAAS & AUDIT ENHANCEMENTS
// ==========================================

// A: Smart Field Suggestions
router.post('/documents/:id/suggest-fields', checkFeatureGate('custom_branding'), async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ _id: req.params.id, workspace_id: req.user.workspaceId });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        // Analyze file content using a mock regex parsing list
        // Real logic parses PDF content stream. Here we suggest coordinates if labels are found.
        const mockSuggestions = [
            { field_type: 'user_signature', label: 'Signature', x_percent: 15, y_percent: 82, width_percent: 25, height_percent: 6 },
            { field_type: 'fullName', label: 'Full Name', x_percent: 15, y_percent: 74, width_percent: 30, height_percent: 4 },
            { field_type: 'date', label: 'Date', x_percent: 60, y_percent: 82, width_percent: 15, height_percent: 4 }
        ];

        res.json({ suggestions: mockSuggestions });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// B: Signer OTP Authentication
router.post('/public/sign/:secureToken/send-otp', async (req, res) => {
    try {
        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.secureToken });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const recipient = doc.recipients.find(r => r.secure_token === req.params.secureToken);
        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

        // Cooldown check: 60 seconds
        if (recipient.otp_cooldown_until && new Date() < recipient.otp_cooldown_until) {
            const waitTime = Math.ceil((recipient.otp_cooldown_until.getTime() - Date.now()) / 1000);
            return res.status(429).json({ message: `Please wait ${waitTime} seconds before requesting a new OTP.` });
        }

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');

        recipient.otp_hash = hashedOtp;
        recipient.otp_expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min validity
        recipient.otp_retries = 0;
        recipient.otp_cooldown_until = new Date(Date.now() + 60 * 1000); // 60s cooldown
        await doc.save();

        // Dispatch Email
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #2563eb;">Verification Code</h2>
                <p>Hello ${recipient.name},</p>
                <p>Please use the following 6-digit One-Time Password (OTP) to authenticate and access the signature document:</p>
                <div style="font-size: 32px; font-weight: 800; letter-spacing: 4px; padding: 15px; background-color: #f1f5f9; text-align: center; border-radius: 8px; color: #1e293b; margin: 20px 0;">
                    ${otpCode}
                </div>
                <p style="font-size: 13px; color: #64748b;">This code is confidential and will expire in 10 minutes.</p>
            </div>
        `;

        await emailTransporter.sendMail({
            from: process.env.GMAIL_USER || 'britsyncuk@gmail.com',
            to: recipient.email,
            subject: `Verification Code for document: ${doc.document_name}`,
            html: emailHtml
        });

        await logAuditEvent({
            workspace_id: doc.workspace_id,
            document_id: doc._id,
            recipient_id: recipient.secure_token,
            event_type: 'OTP_SENT',
            metadata: { recipient_email: recipient.email }
        });

        res.json({ message: 'OTP sent successfully to your registered email' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/public/sign/:secureToken/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ message: 'OTP is required' });

        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.secureToken });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const recipient = doc.recipients.find(r => r.secure_token === req.params.secureToken);
        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

        // Expiry check
        if (!recipient.otp_expiry || new Date() > recipient.otp_expiry) {
            return res.status(400).json({ message: 'OTP code has expired. Please request a new one.' });
        }

        // Retry limit check (max 3 retries)
        if (recipient.otp_retries >= 3) {
            return res.status(400).json({ message: 'Too many failed verification attempts. Please request a new code.' });
        }

        const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
        if (recipient.otp_hash !== hashedInput) {
            recipient.otp_retries += 1;
            await doc.save();
            return res.status(400).json({ message: `Invalid code. ${3 - recipient.otp_retries} attempts remaining.` });
        }

        // Correct OTP code! Clear hash/expiry to prevent replay attacks
        recipient.otp_hash = '';
        recipient.otp_expiry = null;
        recipient.auth_verified_at = new Date();
        await doc.save();

        await logAuditEvent({
            workspace_id: doc.workspace_id,
            document_id: doc._id,
            recipient_id: recipient.secure_token,
            event_type: 'OTP_VERIFIED',
            metadata: { recipient_email: recipient.email }
        });

        res.json({ verified: true, message: 'OTP verified successfully!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/public/sign/:secureToken/verify-passcode', async (req, res) => {
    try {
        const { passcode } = req.body;
        if (!passcode) return res.status(400).json({ message: 'Passcode is required' });

        const doc = await DocuDocumentNew.findOne({ 'recipients.secure_token': req.params.secureToken });
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const recipient = doc.recipients.find(r => r.secure_token === req.params.secureToken);
        if (!recipient) return res.status(404).json({ message: 'Recipient not found' });

        const hashedInput = crypto.createHash('sha256').update(passcode).digest('hex');
        if (recipient.passcode_hash !== hashedInput) {
            return res.status(400).json({ message: 'Invalid passcode code.' });
        }

        recipient.auth_verified_at = new Date();
        await doc.save();

        await logAuditEvent({
            workspace_id: doc.workspace_id,
            document_id: doc._id,
            recipient_id: recipient.secure_token,
            event_type: 'PASSCODE_VERIFIED',
            metadata: { recipient_email: recipient.email }
        });

        res.json({ verified: true, message: 'Passcode verified successfully!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// C: Public Web Forms
router.get('/public/forms/:slug', async (req, res) => {
    try {
        const form = await DocuWebForm.findOne({ slug: req.params.slug, is_active: true });
        if (!form) return res.status(404).json({ message: 'Public form not found or inactive.' });

        if (form.expiry_date && new Date() > form.expiry_date) {
            return res.status(400).json({ message: 'This public form has expired.' });
        }

        if (form.submission_limit > 0 && form.submission_count >= form.submission_limit) {
            return res.status(400).json({ message: 'This form has reached its submission limit.' });
        }

        const template = await DocuTemplate.findById(form.template_id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        res.json({ form, template });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/public/forms/:slug/submit', async (req, res) => {
    try {
        const { submitter_name, submitter_email, field_values } = req.body;
        if (!submitter_name || !submitter_email) {
            return res.status(400).json({ message: 'Submitter name and email are required' });
        }

        const form = await DocuWebForm.findOne({ slug: req.params.slug, is_active: true });
        if (!form) return res.status(404).json({ message: 'Public form not found' });

        if (form.expiry_date && new Date() > form.expiry_date) {
            return res.status(400).json({ message: 'This form has expired.' });
        }

        if (form.submission_limit > 0 && form.submission_count >= form.submission_limit) {
            return res.status(400).json({ message: 'This form has reached its submission limit.' });
        }

        const template = await DocuTemplate.findById(form.template_id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        // Enforce document limits on parent workspace
        const ws = await DocuWorkspace.findById(form.workspace_id);
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });

        const counter = await getActiveUsageCounter(ws._id);
        const plan = ws.plan || 'free';
        const limits = PLAN_LIMITS[plan];

        if (counter.documents_sent >= limits.documents_sent) {
            return res.status(403).json({ message: 'The host workspace has reached its monthly submission/document limit.' });
        }

        // Create document instance from template
        const doc = new DocuDocumentNew({
            workspace_id: form.workspace_id,
            owner_id: ws.owner_id,
            document_name: `${template.template_name} - ${submitter_name}`,
            original_file_url: template.file_url,
            original_hash: template.original_hash || '',
            source_type: 'template',
            template_id: template._id,
            status: 'sent',
            sent_at: new Date(),
            fields: template.fields.map(f => {
                const fObj = f.toObject();
                // Assign value if submitted in form
                if (field_values && field_values[f.label]) {
                    fObj.value = field_values[f.label];
                }
                return fObj;
            }),
            recipients: [{
                name: submitter_name,
                email: submitter_email,
                role: 'signer',
                status: 'sent',
                secure_token: crypto.randomBytes(32).toString('hex')
            }]
        });

        const savedDoc = await doc.save();

        // Increment usage counters
        await DocuUsageCounter.updateOne(
            { _id: counter._id },
            { $inc: { documents_sent: 1 } }
        );

        await DocuWebForm.updateOne(
            { _id: form._id },
            { $inc: { submission_count: 1 } }
        );

        await logAuditEvent({
            workspace_id: form.workspace_id,
            document_id: savedDoc._id,
            event_type: 'DOCUMENT_CREATED',
            metadata: { source: 'web_form', submitter_email }
        });

        res.status(201).json({ message: 'Form submitted successfully!', secure_token: savedDoc.recipients[0].secure_token });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ===== Fingerprint Auth Routes =====

// POST /auth/fingerprint/register - register via fingerprint device
router.post('/auth/fingerprint/register', async (req, res) => {
    try {
        const { device_token, device_name, device_info } = req.body;
        if (!device_token) {
            return res.status(400).json({ message: 'Device token is required' });
        }

        const existing = await DocuFingerprintDevice.findOne({ device_token }).populate('user_id');
        if (existing) {
            existing.last_active = new Date();
            await existing.save();
            const user = existing.user_id;
            const member = await DocuWorkspaceMember.findOne({ user_id: user._id, status: 'joined' }).populate('workspace_id');
            const wsId = member ? member.workspace_id._id : user.default_workspace_id;
            const token = jwt.sign(
                { id: user._id, email: user.email, workspaceId: wsId },
                process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
                { expiresIn: '7d' }
            );
            return res.json({
                token, user: { id: user._id, full_name: user.full_name, email: user.email, onboarding_completed: user.onboarding_completed },
                is_new: false, has_backup_credentials: user.password_hash && user.password_hash !== 'fingerprint_auth_only'
            });
        }

        const full_name = device_name || `User-${device_token.slice(-6)}`;
        const email = `fp_${device_token.slice(-12)}@fingerprint.britsync`;
        const password_hash = 'fingerprint_auth_only';

        const newUser = new DocuUser({
            full_name, email, password_hash,
            email_verified: true,
            onboarding_completed: false
        });
        const savedUser = await newUser.save();

        const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        const workspace = new DocuWorkspace({
            name: `${full_name}'s Personal Workspace`,
            owner_id: savedUser._id,
            workspace_type: 'PERSONAL',
            workspace_code: wsCode,
            slug: `ws-${wsCode.toLowerCase()}`,
            plan: 'free',
            subscription_status: 'active'
        });
        const savedWs = await workspace.save();

        const membership = new DocuWorkspaceMember({
            workspace_id: savedWs._id,
            user_id: savedUser._id,
            role: 'owner',
            status: 'joined',
            joined_at: new Date()
        });
        await membership.save();

        savedUser.personal_workspace_id = savedWs._id;
        savedUser.default_workspace_id = savedWs._id;
        await savedUser.save();

        const fpDevice = new DocuFingerprintDevice({
            user_id: savedUser._id,
            device_token,
            device_name: device_name || '',
            device_info: device_info || ''
        });
        await fpDevice.save();

        const token = jwt.sign(
            { id: savedUser._id, email: savedUser.email, workspaceId: savedWs._id },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token, user: { id: savedUser._id, full_name: savedUser.full_name, email: savedUser.email, onboarding_completed: false },
            is_new: true, has_backup_credentials: false
        });
    } catch (err) {
        console.error('Fingerprint register error:', err);
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
});

// POST /auth/fingerprint/login - login via device token
router.post('/auth/fingerprint/login', async (req, res) => {
    try {
        const { device_token } = req.body;
        if (!device_token) {
            return res.status(400).json({ message: 'Device token is required' });
        }

        const fpDevice = await DocuFingerprintDevice.findOne({ device_token }).populate('user_id');
        if (!fpDevice) {
            return res.status(401).json({ message: 'Device not recognized. Please sign up first.' });
        }

        fpDevice.last_active = new Date();
        await fpDevice.save();

        const user = fpDevice.user_id;
        if (user.status === 'SUSPENDED') {
            return res.status(403).json({ message: 'Your account has been suspended.' });
        }

        let wsId = user.default_workspace_id;
        let member = null;
        if (wsId) {
            member = await DocuWorkspaceMember.findOne({ user_id: user._id, workspace_id: wsId, status: 'joined' }).populate('workspace_id');
        }
        if (!member) {
            member = await DocuWorkspaceMember.findOne({ user_id: user._id, status: 'joined' }).populate('workspace_id');
        }

        user.last_login_at = new Date();
        user.last_login_ip = req.ip || req.headers['x-forwarded-for'] || 'Unknown';
        await user.save();

        const wId = member ? member.workspace_id._id : user.default_workspace_id;
        const token = jwt.sign(
            { id: user._id, email: user.email, workspaceId: wId },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        res.json({
            token, user: { id: user._id, full_name: user.full_name, email: user.email, onboarding_completed: user.onboarding_completed },
            is_new: false, has_backup_credentials: user.password_hash && user.password_hash !== 'fingerprint_auth_only'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /auth/fingerprint/set-password - add email/password backup to fingerprint account
router.post('/auth/fingerprint/set-password', authenticateDocuToken, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const existingUser = await DocuUser.findOne({ email });
        if (existingUser && existingUser._id.toString() !== req.user.id) {
            return res.status(400).json({ message: 'Email already in use by another account' });
        }

        const user = await DocuUser.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        user.email = email;
        user.password_hash = password_hash;
        user.full_name = req.body.full_name || user.full_name;
        await user.save();

        // Update workspace name if it was the auto-generated one
        if (user.personal_workspace_id) {
            const ws = await DocuWorkspace.findById(user.personal_workspace_id);
            if (ws && ws.name.startsWith('User-')) {
                ws.name = `${user.full_name}'s Personal Workspace`;
                await ws.save();
            }
        }

        // Return new token with updated info
        const member = await DocuWorkspaceMember.findOne({ user_id: user._id, status: 'joined' }).populate('workspace_id');
        const wsId = member ? member.workspace_id._id : user.default_workspace_id;
        const newToken = jwt.sign(
            { id: user._id, email: user.email, workspaceId: wsId },
            process.env.JWT_SECRET || 'Britsync@JWT_92x!KpZ#2025',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Backup credentials saved successfully',
            token: newToken,
            user: { id: user._id, full_name: user.full_name, email: user.email }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /auth/fingerprint/status - check if fingerprint user has backup credentials
router.get('/auth/fingerprint/status', authenticateDocuToken, async (req, res) => {
    try {
        const user = await DocuUser.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const fpDevice = await DocuFingerprintDevice.findOne({ user_id: user._id });
        res.json({
            is_fingerprint_user: !!fpDevice,
            has_backup_credentials: user.password_hash && user.password_hash !== 'fingerprint_auth_only',
            email: user.email
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

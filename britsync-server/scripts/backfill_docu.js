require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
if (dns.setServers) {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
const mongoose = require('mongoose');
const crypto = require('crypto');

// Load Models
const DocuUser = require('../models/DocuUser');
const DocuWorkspace = require('../models/DocuWorkspace');
const DocuWorkspaceMember = require('../models/DocuWorkspaceMember');
const DocuUsageCounter = require('../models/DocuUsageCounter');
const DocuJoinRequest = require('../models/DocuJoinRequest');
const DocuInvite = require('../models/DocuInvite');
const DocuSubscription = require('../models/DocuSubscription');
const DocuWebForm = require('../models/DocuWebForm');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set in environment.');
        process.exit(1);
    }

    console.log('Connecting to MongoDB at:', uri);
    await mongoose.connect(uri, {
        tlsAllowInvalidCertificates: true,
        tlsAllowInvalidHostnames: true
    });
    console.log('Connected successfully!');

    try {
        // 1. Ensure indexes
        console.log('Ensuring all models build indexes...');
        await DocuUser.ensureIndexes();
        await DocuWorkspace.ensureIndexes();
        await DocuWorkspaceMember.ensureIndexes();
        await DocuUsageCounter.ensureIndexes();
        await DocuJoinRequest.ensureIndexes();
        await DocuInvite.ensureIndexes();
        await DocuSubscription.ensureIndexes();
        await DocuWebForm.ensureIndexes();
        console.log('Indexes built successfully.');

        // 2. Migration: Backfill Workspaces
        console.log('Backfilling workspaces...');
        const workspaces = await DocuWorkspace.find();
        for (const ws of workspaces) {
            let updated = false;

            if (!ws.workspace_type) {
                ws.workspace_type = 'PERSONAL';
                updated = true;
            }
            if (!ws.plan) {
                ws.plan = 'free';
                updated = true;
            }
            if (!ws.subscription_status) {
                ws.subscription_status = 'active';
                updated = true;
            }
            if (!ws.workspace_code) {
                ws.workspace_code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char unique code
                updated = true;
            }
            if (!ws.slug) {
                ws.slug = ws.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                if (!ws.slug) ws.slug = `ws-${ws.workspace_code.toLowerCase()}`;
                updated = true;
            }

            if (updated) {
                await ws.save();
                console.log(`Updated Workspace: ${ws.name} (Code: ${ws.workspace_code}, Slug: ${ws.slug})`);
            }
        }

        // 3. Migration: Backfill Users
        console.log('Backfilling users...');
        const users = await DocuUser.find();
        for (const user of users) {
            let updated = false;

            if (user.onboarding_completed === undefined) {
                user.onboarding_completed = true; // Legacy users count as onboarded
                updated = true;
            }

            // Associate their active workspace
            const membership = await DocuWorkspaceMember.findOne({ user_id: user._id, role: 'owner' });
            if (membership) {
                if (!user.personal_workspace_id) {
                    user.personal_workspace_id = membership.workspace_id;
                    updated = true;
                }
                if (!user.default_workspace_id) {
                    user.default_workspace_id = membership.workspace_id;
                    updated = true;
                }
            } else {
                // If they don't own any, pick first workspace they joined
                const anyMembership = await DocuWorkspaceMember.findOne({ user_id: user._id, status: 'joined' });
                if (anyMembership) {
                    if (!user.default_workspace_id) {
                        user.default_workspace_id = anyMembership.workspace_id;
                        updated = true;
                    }
                }
            }

            if (updated) {
                await user.save();
                console.log(`Updated User: ${user.email} (Personal WS: ${user.personal_workspace_id})`);
            }
        }

        // 4. Migration: Backfill Workspace Members
        console.log('Backfilling workspace members...');
        const members = await DocuWorkspaceMember.find();
        for (const member of members) {
            let updated = false;

            if (member.role === 'member') {
                member.role = 'sender';
                updated = true;
            }
            if (!member.status) {
                member.status = 'joined';
                updated = true;
            }
            if (!member.joined_at && member.status === 'joined') {
                member.joined_at = member.createdAt || new Date();
                updated = true;
            }

            if (updated) {
                await member.save();
                console.log(`Updated Member: User ID ${member.user_id} in WS ID ${member.workspace_id} to role: ${member.role}`);
            }
        }

        // 5. Migration: Backfill Usage Counters
        console.log('Backfilling usage counters...');
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const activeWorkspaces = await DocuWorkspace.find();
        for (const ws of activeWorkspaces) {
            const counter = await DocuUsageCounter.findOne({ workspace_id: ws._id, period_start: start });
            if (!counter) {
                await new DocuUsageCounter({
                    workspace_id: ws._id,
                    period_start: start,
                    period_end: end,
                    documents_sent: 0,
                    documents_completed: 0,
                    templates_created: 0,
                    bulk_sends: 0,
                    storage_used_mb: 0,
                    signer_auth_count: 0
                }).save();
                console.log(`Created current billing period usage counter for WS: ${ws.name}`);
            }
        }

        console.log('Migration and backfill completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

run();

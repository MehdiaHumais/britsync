const mongoose = require('mongoose');

const DocuWorkspaceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, default: '', index: true },
    workspace_code: { type: String, default: '', index: true },
    company_email: { type: String, default: '' },
    domain: { type: String, default: '', lowercase: true, trim: true },
    website: { type: String, default: '' },
    industry: { type: String, default: '' },
    company_size: { type: String, default: '' },
    logo_url: { type: String, default: '' },
    brand_color: { type: String, default: '#3b82f6' },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuUser', required: true },
    workspace_type: { type: String, enum: ['PERSONAL', 'COMPANY'], default: 'PERSONAL' },
    plan: { type: String, enum: ['free', 'pro', 'business', 'enterprise'], default: 'free' },
    subscription_status: { type: String, default: 'active' },
    stripe_customer_id: { type: String, default: '' },
    stripe_subscription_id: { type: String, default: '' },
    current_period_start: { type: Date },
    current_period_end: { type: Date },
    domain_join_enabled: { type: Boolean, default: false },
    invite_link_enabled: { type: Boolean, default: true },
    require_approval_for_join: { type: Boolean, default: true },
    auto_approve_domain_users: { type: Boolean, default: false },
    default_role_for_domain_users: { type: String, enum: ['admin', 'manager', 'sender', 'viewer'], default: 'viewer' }
}, {
    timestamps: true,
    collection: 'docu_workspaces'
});

module.exports = mongoose.model('DocuWorkspace', DocuWorkspaceSchema);

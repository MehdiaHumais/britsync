const mongoose = require('mongoose');

const DocuWebhookSchema = new mongoose.Schema({
    workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuWorkspace', required: true, index: true },
    endpoint_url: { type: String, required: true },
    secret: { type: String, required: true },
    events: [{ type: String, required: true }],
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuUser', required: true }
}, {
    timestamps: true,
    collection: 'docu_webhooks'
});

module.exports = mongoose.model('DocuWebhook', DocuWebhookSchema);

const mongoose = require('mongoose');

const DocuWebhookDeliverySchema = new mongoose.Schema({
    webhook_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuWebhook', required: true, index: true },
    workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuWorkspace', required: true, index: true },
    event_type: { type: String, required: true },
    payload: { type: String, default: '' },
    response_status: { type: Number },
    response_body: { type: String, default: '' },
    attempt_count: { type: Number, default: 1 },
    status: { type: String, enum: ['success', 'failed'], default: 'failed' },
    error_message: { type: String, default: '' }
}, {
    timestamps: true,
    collection: 'docu_webhook_deliveries'
});

module.exports = mongoose.model('DocuWebhookDelivery', DocuWebhookDeliverySchema);

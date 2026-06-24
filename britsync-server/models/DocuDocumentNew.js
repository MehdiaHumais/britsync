const mongoose = require('mongoose');

const RecipientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['signer', 'approver', 'viewer', 'cc'], default: 'signer' },
    signing_order: { type: Number, default: 1 },
    secure_token: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'sent', 'viewed', 'completed', 'declined'], default: 'pending' },
    viewed_at: { type: Date },
    signed_at: { type: Date },
    completed_at: { type: Date },
    ip_address: { type: String, default: '' },
    user_agent: { type: String, default: '' }
}, { timestamps: true });

const DocumentFieldSchema = new mongoose.Schema({
    page_number: { type: Number, required: true },
    field_type: { 
        type: String, 
        enum: [
            'text', 'textarea', 'user_signature', 'initials', 'date', 
            'checkbox', 'radio', 'dropdown', 'email', 'phone', 'number', 
            'fullName', 'company', 'address', 'jobTitle', 'readonlyNote', 
            'fileUpload', 'stamp', 'approval', 'decline'
        ], 
        required: true 
    },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: true },
    x_percent: { type: Number, required: true },
    y_percent: { type: Number, required: true },
    width_percent: { type: Number, required: true },
    height_percent: { type: Number, required: true },
    value: { type: String, default: '' },
    options_json: { type: String, default: '' }, // For dropdown, radios, etc.
    validation_type: { type: String, default: '' },
    font_size: { type: Number, default: 12 },
    alignment: { type: String, default: 'left' },
    signature_data: { type: String, default: '' }, // Base64 signature image
    assigned_recipient_id: { type: String, default: '' }, // Points to Recipient _id or 'sender'/'all'
    help_text: { type: String, default: '' }
}, { timestamps: true });

const DocuDocumentNewSchema = new mongoose.Schema({
    workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuWorkspace', required: true },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuUser', required: true },
    document_name: { type: String, required: true },
    original_file_url: { type: String, required: true },
    final_file_url: { type: String, default: '' },
    audit_report_url: { type: String, default: '' },
    original_hash: { type: String, default: '' },
    final_hash: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['draft', 'sent', 'viewed', 'completed', 'expired', 'archived', 'declined'], 
        default: 'draft' 
    },
    source_type: { type: String, enum: ['upload', 'template'], default: 'upload' },
    template_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuTemplate' },
    signing_order_enabled: { type: Boolean, default: false },
    expires_at: { type: Date },
    sent_at: { type: Date },
    viewed_at: { type: Date },
    completed_at: { type: Date },
    cancelled_at: { type: Date },
    archived_at: { type: Date },
    recipients: [RecipientSchema],
    fields: [DocumentFieldSchema]
}, {
    timestamps: true,
    collection: 'docu_documents'
});

module.exports = mongoose.model('DocuDocumentNew', DocuDocumentNewSchema);

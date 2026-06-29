const mongoose = require('mongoose');

const DocuWorkspaceMemberSchema = new mongoose.Schema({
    workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuWorkspace', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuUser', required: true },
    role: { type: String, enum: ['owner', 'admin', 'manager', 'sender', 'viewer', 'member'], default: 'member' },
    status: { type: String, enum: ['invited', 'joined', 'left', 'removed'], default: 'invited' },
    invited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuUser' },
    joined_at: { type: Date },
    left_at: { type: Date }
}, {
    timestamps: true,
    collection: 'docu_workspace_members'
});

module.exports = mongoose.model('DocuWorkspaceMember', DocuWorkspaceMemberSchema);

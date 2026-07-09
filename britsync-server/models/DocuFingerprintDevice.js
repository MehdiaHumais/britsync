const mongoose = require('mongoose');

const DocuFingerprintDeviceSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DocuUser', required: true, index: true },
    device_token: { type: String, required: true, unique: true, index: true },
    device_name: { type: String, default: '' },
    device_info: { type: String, default: '' },
    last_active: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'docu_fingerprint_devices'
});

module.exports = mongoose.model('DocuFingerprintDevice', DocuFingerprintDeviceSchema);

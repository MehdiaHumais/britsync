require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true
  });

  const DocuUser = require('../models/DocuUser');
  const DocuWorkspace = require('../models/DocuWorkspace');
  const DocuWorkspaceMember = require('../models/DocuWorkspaceMember');
  const crypto = require('crypto');

  const email = 'waqarshakil.ahmed@gmail.com';
  let user = await DocuUser.findOne({ email });
  if (user) {
    console.log('Super admin already exists:', email);
    await mongoose.disconnect();
    return;
  }

  const hash = await bcrypt.hash('superadmin123', 10);
  user = new DocuUser({
    full_name: 'Waqar Ahmed (Super Admin)',
    email,
    password_hash: hash,
    email_verified: true,
    onboarding_completed: true,
    platform_role: 'SUPER_ADMIN',
    status: 'ACTIVE'
  });
  await user.save();

  const wsCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const ws = new DocuWorkspace({
    name: "Waqar's Personal Workspace",
    owner_id: user._id,
    workspace_type: 'PERSONAL',
    workspace_code: wsCode,
    slug: `ws-${wsCode.toLowerCase()}`,
    plan: 'free',
    subscription_status: 'active'
  });
  const savedWs = await ws.save();

  await new DocuWorkspaceMember({
    workspace_id: savedWs._id,
    user_id: user._id,
    role: 'owner',
    status: 'joined',
    joined_at: new Date()
  }).save();

  user.personal_workspace_id = savedWs._id;
  user.default_workspace_id = savedWs._id;
  await user.save();

  console.log('Super admin created! Email:', email, 'Password: superadmin123');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

const adminUser = process.env.ADMIN_USERNAME;
const adminPass = process.env.ADMIN_PASSWORD;
const displayName = process.env.ADMIN_DISPLAY_NAME || adminUser;
const adminInvite = process.env.ADMIN_INVITE_CODE;

if (!adminUser || !adminPass || !adminInvite) {
  throw new Error('ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_INVITE_CODE must be configured');
}

function isAdminName(name) {
  return name === adminUser;
}

function resolveDisplayName(name) {
  return isAdminName(name) ? displayName : name;
}

module.exports = { adminUser, adminPass, adminInvite, displayName, isAdminName, resolveDisplayName };

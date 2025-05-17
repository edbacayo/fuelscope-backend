const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');

exports.resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    // 1. Generate a secure random password
    const tempPassword = crypto.randomBytes(6).toString('base64');
    // 2. Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    // 3. Hash temp password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(tempPassword, salt);
    // 4. Set mustResetPassword
    user.mustResetPassword = true;
    // 5. Save user
    await user.save();
    // 6. Return temp password
    return res.json({ tempPassword });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }
  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Old password is incorrect.' });
  }
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.mustResetPassword = false;
  await user.save();
  return res.json({ message: 'Password changed successfully.' });
};

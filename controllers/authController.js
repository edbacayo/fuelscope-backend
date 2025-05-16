const bcrypt = require('bcryptjs');
const User = require('../models/User');

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
  await user.save();
  return res.json({ message: 'Password changed successfully.' });
};

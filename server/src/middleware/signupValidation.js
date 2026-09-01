const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');

/**
 * Shared input validation rules for signup.
 * Sanitizes all string fields to prevent injection attacks.
 */
const signupValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .escape(),
  body('password')
    .isString()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .trim(),
  body('fullName')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 120 }).withMessage('Name too long')
    .escape(),
];

module.exports = {
  signupValidation,
};

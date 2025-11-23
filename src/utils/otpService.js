// utils/otpService.js
import axios from 'axios';
import AppError from './appError.js';

const WHATSAPP_API_URL = ` https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages `
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;

/**
 * Send OTP via WhatsApp using WhatsApp Business Cloud API
 * @param {string} phone - 10-digit phone number (without +91)
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendOtpWhatsApp = async (phone, otp) => {
    try {
        // Validate inputs
        if (!phone || phone.length !== 10) {
            throw new Error('Invalid phone number format');
        }

        if (!otp || otp.length !== 6) {
            throw new Error('Invalid OTP format');
        }

        if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_API_URL) {
            throw new Error('WhatsApp API credentials not configured');
        }

        // Format phone number with country code
        const phoneWithCountryCode = `91${phone}`;

        // Prepare message payload
        const messagePayload = {
            messaging_product: 'whatsapp',
            to: phoneWithCountryCode,
            type: 'template',
            template: {
                name: 'affiliate_otp', // Template name in WhatsApp Business Account
                language: {
                    code: 'en_US',
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: otp,
                            },
                        ],
                    },
                ],
            },
        };

        // Send request to WhatsApp API
        const response = await axios.post(WHATSAPP_API_URL, messagePayload, {
            headers: {
                Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.data?.messages?.[0]?.id) {
            return {
                success: true,
                messageId: response.data.messages[0].id,
            };
        } else {
            throw new Error('Failed to send WhatsApp message');
        }
    } catch (error) {
        console.error('WhatsApp OTP Send Error:', error.response?.data || error.message);

        // Log error details for debugging
        if (error.response?.data?.error) {
            console.error('WhatsApp API Error:', error.response.data.error);
        }

        return {
            success: false,
            error: error.message || 'Failed to send OTP via WhatsApp',
        };
    }
};

/**
 * Send OTP via SMS as fallback (optional)
 * You can integrate with services like Twilio, AWS SNS, etc.
 * @param {string} phone - 10-digit phone number
 * @param {string} otp - 6-digit OTP
 */
export const sendOtpSMS = async (phone, otp) => {
    try {
        // Example integration with Twilio or similar service
        // This is a placeholder - implement based on your SMS provider

        if (!process.env.SMS_PROVIDER_API_KEY) {
            console.warn('SMS provider not configured');
            return {
                success: false,
                error: 'SMS provider not configured',
            };
        }

        // Example: Twilio integration
        // const twilio = require('twilio');
        // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // await client.messages.create({
        //     body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
        //     from: process.env.TWILIO_PHONE_NUMBER,
        //     to: `+91${phone}`,
        // });

        return {
            success: true,
            message: 'OTP sent via SMS',
        };
    } catch (error) {
        console.error('SMS OTP Send Error:', error.message);
        return {
            success: false,
            error: error.message || 'Failed to send OTP via SMS',
        };
    }
};

/**
 * Generate OTP
 * @returns {string} 6-digit OTP
 */
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Verify OTP logic
 * @param {string} providedOtp - OTP provided by user
 * @param {string} storedOtp - OTP stored in database
 * @param {Date} expiresAt - OTP expiry timestamp
 * @returns {object} {isValid: boolean, error?: string}
 */
export const verifyOtpLogic = (providedOtp, storedOtp, expiresAt) => {
    // Check if OTP exists
    if (!storedOtp) {
        return {
            isValid: false,
            error: 'No OTP found. Please request a new one.',
        };
    }

    // Check if OTP has expired
    if (new Date() > new Date(expiresAt)) {
        return {
            isValid: false,
            error: 'OTP has expired. Please request a new one.',
        };
    }

    // Check if OTP matches
    if (providedOtp !== storedOtp) {
        return {
            isValid: false,
            error: 'Invalid OTP',
        };
    }

    return {
        isValid: true,
    };
};

/**
 * Resend OTP
 * @param {object} user - User document
 * @param {string} medium - 'whatsapp' or 'sms'
 */
export const resendOTP = async (user, medium = 'whatsapp') => {
    try {
        // Check if user exists
        if (!user || !user.phone) {
            return {
                success: false,
                error: 'User not found',
            };
        }

        // Generate new OTP
        const newOtp = generateOTP();
        const expiresIn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update user with new OTP
        user.otp = newOtp;
        user.otpExpiresIn = expiresIn;
        await user.save({ validateBeforeSave: false });

        // Send OTP via selected medium
        let result;
        if (medium === 'sms') {
            result = await sendOtpSMS(user.phone, newOtp);
        } else {
            result = await sendOtpWhatsApp(user.phone, newOtp);
        }

        return result;
    } catch (error) {
        console.error('Resend OTP Error:', error.message);
        return {
            success: false,
            error: error.message || 'Failed to resend OTP',
        };
    }
};
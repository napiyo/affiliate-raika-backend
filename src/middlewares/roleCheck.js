import jwt from 'jsonwebtoken';
import AppError from '../utils/appError.js';

export const roleCheck = (...roles) => {
    return (req, res, next) => {
        if (!req.body.user) {
            return next(new AppError('You are not logged in!', 401));
        }

        if (!roles.includes(req.body.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        next();
    };
};


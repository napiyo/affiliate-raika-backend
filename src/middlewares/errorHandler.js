import jwttoken  from "jsonwebtoken";
import { clearCookie } from "../utils/jwtUtils.js";
const {TokenExpiredError} = jwttoken;
const errorHandler = (err, req, res, next) => {
    // Set default status code to 500
    err.statusCode = err.statusCode || 500;

    // console.log(err);
    
    
    if((err.message && err.message.startsWith("invalid-user") )|| err instanceof TokenExpiredError)
    {
        clearCookie(res, req.cookies?.jwt)
    }
    const tempErr = err.response?.data?.error?.message || err.response?.data?.error?.details 
    if(tempErr) err.message = tempErr;
    // Send error response
    res.status(err.statusCode).json({
        success: false,
        message: err.message,

    });
};

export default errorHandler;
import jsonwebtoken from 'jsonwebtoken';
import { promisify } from 'util';

const {sign, verify} = jsonwebtoken;


export const signToken = (id) => {
    return sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

export const verifyToken = async (token) => {
    return await promisify(verify)(token, process.env.JWT_SECRET);
};

export const setCookie =(res,token)=>
{
    res.cookie('jwt', token, {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: true, 
         sameSite: 'None',
        path: "/",
    });
}
export const clearCookie =(res,token)=>
    {
        res.clearCookie('jwt', token, {
            expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: true, 
            sameSite: 'None', 
            path: "/",
        });
    }
    

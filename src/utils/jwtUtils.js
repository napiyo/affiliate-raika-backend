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


export const setCookie = (res, token) => {
  const isDev = process.env.DEV_MODE === "on";

  res.cookie("jwt", token, {
    expires: new Date(
      Date.now() +
        process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: !isDev,              // secure only in production (HTTPS)
    sameSite: isDev ? "None" : "Lax",
    domain: isDev ? undefined : ".raikaphotography.com", 
    path: "/",
  });
};

export const clearCookie =(res,token)=>
    {
        res.clearCookie('jwt', {
            httpOnly: true,
            secure: !isDev, 
            sameSite: isDev ? "None" : "Lax",
            domain: isDev ? undefined : ".raikaphotography.com", 
            path: "/",
        });
    }
    

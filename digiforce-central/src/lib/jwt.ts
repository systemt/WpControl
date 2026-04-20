import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    issuer: config.APP_NAME,
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET, { issuer: config.APP_NAME });
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
}

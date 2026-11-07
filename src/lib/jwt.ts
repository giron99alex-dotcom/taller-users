import { sign, verify, type JwtPayload, type SignOptions } from "jsonwebtoken";

export interface TokenPayload extends JwtPayload {
  userId: string;
  email?: string;
  role?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado");

  return sign(payload, secret, {
    expiresIn: "1h" as SignOptions["expiresIn"],
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET no está configurado");

  return sign(payload, secret, {
    expiresIn: "7d" as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado");

  return verify(token, secret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET no está configurado");

  return verify(token, secret) as TokenPayload;
}
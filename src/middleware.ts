import { Request, Response, NextFunction } from 'express'
import { verifyJWT } from '@/utils'
import type { Role } from '@/types'
import type { Socket } from 'socket.io'

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.session || ''
  if (!token)
    return res.status(401).json({ error: true, message: 'Unauthorized' })

  try {
    const decoded = verifyJWT(token)
    ;(req as any).user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' })
  }
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any)?.user.role !== role) {
      return res.status(403).json({ error: true, message: 'Forbidden' })
    }
    next()
  }
}

export function socketMiddleware(socket: Socket, next: any) {
  try {
    const reqCookies = socket.handshake.headers.cookie || ''
    let token
    if (reqCookies) {
      const sessionCookieRaw = reqCookies
        .split(';')
        .find((cookie) => cookie.includes('session='))
      if (sessionCookieRaw) token = sessionCookieRaw.replace('session=', '')
    }
    if (!token) {
      return next(new Error('Authentication error: missing token'))
    }
    token = token.replace(/ /g, '')

    const decoded = verifyJWT(token)
    ;(socket as any).user = decoded

    next()
  } catch (err) {
    next(new Error('Forbidden'))
  }
}

import { Request, Response, NextFunction } from 'express'
import { verifyJWT } from '@/utils'
import type { Role } from '@/types'

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

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const generateJWT = (payload: any, expiresIn = '3d') => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn
  })
}

const verifyJWT = (token: any) => {
  return jwt.verify(token, process.env.JWT_SECRET!)
}

const hashedPassword = async (password: string) =>
  await bcrypt.hash(password, 10)

const comparePassword = async (password: string, pwHashed: string) =>
  await bcrypt.compare(password, pwHashed)

const getRandom6DigitsOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

export {
  generateJWT,
  verifyJWT,
  hashedPassword,
  comparePassword,
  getRandom6DigitsOtp
}

import { Role } from '@/firebase'
import { Response } from 'express'

interface CreateEmployeeParams {
  name: string
  phone: string
  email: string
  role: Role
}

type ValidateOtpParams = (
  | { userField: 'phone'; data: { phone: string } }
  | { userField: 'email'; data: { email: string; password: string } }
) & { otp: string; res: Response }

export { CreateEmployeeParams }
export type { ValidateOtpParams }

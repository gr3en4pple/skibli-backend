import { Response } from 'express'

type Role = 'owner' | 'employee'

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

type TaskStatus = 'todo' | 'inprogress' | 'done'

interface Task {
  id?: string
  title: string
  description: string
  assignee: string
  status: TaskStatus
  createdAt?: any
  updatedAt?: any
}

interface CreateTaskParams {
  title: string
  description: string
  assigneeId: string
}

export { CreateEmployeeParams, CreateTaskParams }
export type { ValidateOtpParams, Role, Task, TaskStatus }

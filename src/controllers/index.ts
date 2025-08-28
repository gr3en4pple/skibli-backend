import { NextFunction, Request, Response } from 'express'
import {
  addEmployee,
  completeCreateEmployee,
  createOtp,
  getAllEmployees,
  getEmployeeById,
  loginByEmail,
  removeEmployee,
  updateEmployee,
  validateOtp,
  verifyEmailLink,
  verifySessionCookie
} from '@/lib/authService'
import {
  createTask,
  getTaskById,
  getEmployeeTasks,
  changeTaskStatus,
  getAllTasks
} from '@/lib/tasksService'
import { verifyJWT } from '@/utils'
import { JwtPayload } from 'jsonwebtoken'
import { TaskStatus } from '@/types'

export default class Controllers {
  async createNewAccessCode(req: Request, res: Response) {
    const { phone } = req.body

    if (!phone) {
      return res.json({
        message: 'Phone number is required',
        error: true,
        status: 400
      })
    }
    return await createOtp({ dataField: 'phone', data: phone, res })
  }

  async validateAccessCode(req: Request, res: Response) {
    const { phone, email, password, otp } = req.body
    if ((email && password && otp) || (phone && otp)) {
      return await validateOtp({
        ...(phone
          ? {
              userField: 'phone',
              data: { phone }
            }
          : {
              userField: 'email',
              data: { email, password }
            }),
        otp,
        res
      })
    }
    return res.json({
      error: true,
      status: 400,
      message: 'Invalid params'
    })
  }

  async getMe(req: Request, res: Response) {
    const user = (req as any)?.user

    return await verifySessionCookie({ userData: user, res })
  }

  async logout(req: Request, res: Response) {
    return res.cookie('session', '').status(200).json({ success: true })
  }

  async loginEmail(req: Request, res: Response) {
    const { password, email } = req.body
    if (!password || !email) {
      return res.json({
        error: true,
        status: 400,
        message: 'Invalid params'
      })
    }
    return await loginByEmail({ password, email }, res)
  }

  async validateEmailLink(req: Request, res: Response) {
    const { token } = req.body
    if (!token)
      return res.status(400).json({ error: true, message: 'Invalid token' })
    const decoded = verifyJWT(token)
    return await verifyEmailLink({ userData: decoded as JwtPayload, res })
  }

  async completeCreateEmployeeByEmailLink(req: Request, res: Response) {
    const { token, username, password } = req.body
    if (!token || !username || !password)
      return res.status(400).json({ error: true, message: 'Invalid token' })
    const decoded = verifyJWT(token)
    return await completeCreateEmployee({
      userData: { token: decoded as JwtPayload, username, password },
      res
    })
  }

  //** OWNER ONLY */
  async getEmployees(req: Request, res: Response) {
    return await getAllEmployees(res)
  }

  async getEmployee(req: Request, res: Response) {
    const { id } = req.params

    if (!id)
      return res.status(400).json({ error: true, message: 'Missing params!' })
    return await getEmployeeById(id, res)
  }

  async createEmployee(req: Request, res: Response) {
    const { name = '', phone = '', email } = req.body

    if (!email)
      return res.status(400).json({ error: true, message: 'Missing params!' })
    return await addEmployee({ name, phone, email, role: 'employee' }, res)
  }

  async deleteEmployee(req: Request, res: Response) {
    const { id } = req.params

    if (!id)
      return res.status(400).json({ error: true, message: 'Missing params!' })
    return await removeEmployee(id as string, res)
  }

  async editEmployee(req: Request, res: Response) {
    const { id } = req.params
    const { name = '', phone = '', email = '' } = req.body

    if (!id || !email)
      return res.status(400).json({ error: true, message: 'Missing params!' })
    if (!name && !phone)
      return res.status(200).json({ success: true, message: 'Successfully!' })

    return await updateEmployee(id as string, { email, name, phone }, res)
  }
  //** OWNER ONLY */

  async updateUserProfile(req: any, res: any) {}

  // ** TASK CONTROLLERS **

  async createTask(req: Request, res: Response) {
    const { title, description, assigneeId } = req.body

    if (!title || !description || !assigneeId) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: title, description, assignee'
      })
    }

    return await createTask({ title, description, assigneeId: assigneeId }, res)
  }

  async getTask(req: Request, res: Response) {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        error: true,
        message: 'Task ID is required'
      })
    }

    return await getTaskById(id, res)
  }

  // Get all tasks (owner only)
  async getAllTasks(req: Request, res: Response) {
    const currentUser = (req as any)?.user
    if (!currentUser?.uid) {
      return res.status(400).json({
        error: true,
        message: 'User not authenticated'
      })
    }
    if (currentUser?.role === 'owner') {
      return await getAllTasks(res)
    }

    return await getEmployeeTasks(currentUser.email, res)
  }

  async updateTaskStatus(req: Request, res: Response) {
    const { id } = req.params
    const { status } = req.body
    const currentUser = (req as any)?.user

    if (!id) {
      return res.status(400).json({
        error: true,
        message: 'Task ID is required'
      })
    }

    if (!status || !['todo', 'inprogress', 'done'].includes(status)) {
      return res.status(400).json({
        error: true,
        message: 'Valid status is required: todo, inprogress, or done'
      })
    }

    return await changeTaskStatus(id, status as TaskStatus, res)
  }
}

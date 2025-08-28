import { Response } from 'express'
import { adminDb, CollectionNames } from '@/firebase'
import { DocumentData, Timestamp } from 'firebase-admin/firestore'
import { CreateTaskParams, Task, TaskStatus } from '@/types'

const createTask = async (params: CreateTaskParams, res: Response) => {
  try {
    const tasksCollection = adminDb.collection(CollectionNames.tasks)

    const employeeRef = adminDb
      .collection(CollectionNames.employees)
      .doc(params.assigneeId)
    const employeeData = await employeeRef.get()

    const taskDoc = await tasksCollection.add({
      ...params,
      user: employeeData.data(),
      email: employeeData.data()?.email,
      status: 'todo' as TaskStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    const newTaskDoc = await taskDoc.get()

    return res.status(200).json({
      success: true,
      message: 'Task created successfully!',
      data: {
        id: taskDoc.id,
        ...newTaskDoc.data()
      }
    })
  } catch (error: any) {
    console.log('createTask error:', error)
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const getTaskById = async (taskId: string, res: Response) => {
  try {
    const tasksCollection = adminDb.collection(CollectionNames.tasks)
    const taskDoc = await tasksCollection.doc(taskId).get()

    if (!taskDoc || !taskDoc.exists) {
      return res.status(404).json({
        error: true,
        message: 'Task not found'
      })
    }

    const taskData = taskDoc.data()
    return res.status(200).json({
      success: true,
      message: 'Get task successfully!',
      data: {
        id: taskDoc.id,
        ...taskData
      }
    })
  } catch (error: any) {
    console.log('getTaskById error:', error)
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const getEmployeeTasks = async (email: string, res: Response) => {
  try {
    const tasksCollection = adminDb.collection(CollectionNames.tasks)
    const snapshot = await tasksCollection.where('email', '==', email).get()

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'Successfully!',
        data: []
      })
    }

    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))

    return res.status(200).json({
      success: true,
      message: 'Get tasks successfully!',
      data: tasks
    })
  } catch (error: any) {
    console.log('getEmployeeTasks error:', error)
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const changeTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus,
  res: Response
) => {
  try {
    const tasksCollection = adminDb.collection(CollectionNames.tasks)
    const taskDoc = tasksCollection.doc(taskId)

    // Check if task exists
    const task = await taskDoc.get()
    if (!task.exists) {
      return res.status(404).json({
        error: true,
        message: 'Task not found'
      })
    }

    // Update task status
    await taskDoc.update({
      status: newStatus,
      updatedAt: Timestamp.now()
    })

    // Get updated task
    const updatedTask = await taskDoc.get()
    const updatedTaskData = updatedTask.data()

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully!',
      data: {
        id: taskDoc.id,
        ...updatedTaskData
      }
    })
  } catch (error: any) {
    console.log('changeTaskStatus error:', error)
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const getAllTasks = async (res: Response) => {
  try {
    const tasksCollection = adminDb.collection(CollectionNames.tasks)
    const snapshot = await tasksCollection.orderBy('updatedAt', 'asc').get()

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No tasks found',
        data: []
      })
    }

    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))

    return res.status(200).json({
      success: true,
      message: 'Get tasks successfully!',
      data: tasks
    })
  } catch (error: any) {
    console.log('getAllTasks error:', error)
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

export {
  createTask,
  getTaskById,
  getEmployeeTasks,
  changeTaskStatus,
  getAllTasks
}

import { JwtPayload } from 'jsonwebtoken'
import { findUser } from '@/service/auth'
import { adminDb, CollectionNames } from '@/firebase'
import { Response } from 'express'
import { generateJWT, hashedPassword } from '@/utils'
import { DocumentData, Timestamp } from 'firebase-admin/firestore'
import { CreateEmployeeParams } from '@/types'
import { sendEmailVerificationLink } from '@/service/mail'
import ms from 'ms'

const verifyEmailLink = async ({
  userData,
  res
}: {
  userData: JwtPayload
  res: Response
}) => {
  const { email, uid, role } = userData

  try {
    const employeesRef = adminDb.collection(CollectionNames.employees)
    const [employeeSnapshot, authUserSnapshot] = await Promise.all([
      employeesRef.where('email', '==', email).get(),
      findUser({ value: email, field: 'email' })
    ])

    if (!authUserSnapshot.empty) {
      return res.status(400).json({ error: true, message: 'Employee exists' })
    }
    if (employeeSnapshot.empty) {
      return res.status(400).json({ error: true, message: 'No employee' })
    }

    const employeeDoc = employeeSnapshot.docs[0]
    const employeeData = employeeDoc.data()

    return res
      .status(200)
      .json({ success: true, user: { ...employeeData, uid: employeeDoc.id } })
  } catch (err) {
    return res
      .status(400)
      .json({ error: true, message: 'Invalid or expired token' })
  }
}

const completeCreateEmployee = async ({
  userData,
  res
}: {
  userData: { token: JwtPayload; username: string; password: string }
  res: Response
}) => {
  const { password, username, token } = userData
  const { email, uid, role } = token

  try {
    const employeesRef = adminDb.collection(CollectionNames.employees)
    const [employeeSnapshot, authUserSnapshot] = await Promise.all([
      employeesRef.where('email', '==', email).get(),
      findUser({ value: email, field: 'email' })
    ])

    // make sure auth_users collection is empty
    if (!authUserSnapshot.empty) {
      return res.status(400).json({ error: true, message: 'Employee exists' })
    }

    // make sure employee exists in employees collection
    if (employeeSnapshot.empty) {
      return res.status(400).json({ error: true, message: 'No employee' })
    }

    const passwordHashed = await hashedPassword(password)

    const authUsersRef = adminDb.collection(CollectionNames.auth_users)
    const userRef = await authUsersRef.add({
      email,
      username,
      password: passwordHashed,
      role: 'employee',
      createdAt: Timestamp.now()
    })
    await employeeSnapshot.docs[0].ref.update({
      hasAccount: true
    })

    const userDoc = await userRef.get()
    const user = userDoc.data() as DocumentData

    const sessionCookie = generateJWT(
      {
        uid: userRef?.id,
        role: (user as any)?.role || 'employee',
        email
      },
      '4h'
    )

    return res
      .cookie('session', sessionCookie, {
        httpOnly: true,
        maxAge: ms('1 day')
      })
      .status(200)
      .json({ success: true, user })
  } catch (err) {
    return res
      .status(400)
      .json({ error: true, message: 'Invalid or expired token' })
  }
}

const addEmployee = async (params: CreateEmployeeParams, res: Response) => {
  try {
    const employeesCollection = adminDb.collection(CollectionNames.employees)

    const emailSnapshot = await employeesCollection
      .where('email', '==', params.email)
      .get()
    if (!emailSnapshot.empty) {
      return res.status(400).json({
        error: true,
        message: 'Email existed'
      })
    }

    if (params?.phone) {
      const phoneSnapshot = await employeesCollection
        .where('phone', '==', params.phone)
        .get()
      if (!phoneSnapshot.empty) {
        return res.status(400).json({
          error: true,
          message: 'Phone existed'
        })
      }

      const authUserByPhone = await findUser({
        field: 'phone',
        value: params.phone
      })
      if (!authUserByPhone.empty) {
        return res.status(400).json({
          error: true,
          message: 'Phone existed'
        })
      }
    }

    const employeeDoc = await employeesCollection.add({
      ...params,
      hasAccount: false,
      createdAt: Timestamp.now()
    })

    const token = generateJWT({
      uid: employeeDoc?.id,
      role: params.role,
      email: params.email
    })

    await sendEmailVerificationLink({
      email: params.email,
      name: params.name,
      verificationLink: `http://localhost:3000/auth/verify-email?token=${token}`
    })

    return res.status(200).json({
      success: true,
      message: 'Successfully!',
      id: employeeDoc.id
    })
  } catch (error: any) {
    console.log('error:', error)
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const removeEmployee = async (id: string, res: Response) => {
  try {
    const employeesCollection = adminDb.collection(CollectionNames.employees)
    const authUsersCollection = adminDb.collection(CollectionNames.auth_users)
    const employeeDoc = await employeesCollection.doc(id).get()
    const employeeData = employeeDoc.data()
    if (!employeeData)
      return res.status(404).json({
        error: true,
        message: 'Not found employee'
      })

    if (employeeData.hasAccount) {
      const authQuerySnapshot = await authUsersCollection
        .where('email', '==', employeeData.email)
        .get()

      await Promise.all(authQuerySnapshot.docs.map((doc) => doc.ref.delete()))
    }

    await employeesCollection.doc(id).delete()
    return res.status(200).json({
      success: true,
      message: 'Successfully!'
    })
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const updateEmployee = async (
  id: string,
  params: { email: string; name?: string; phone?: string },
  res: Response
) => {
  try {
    const employeesCollection = adminDb.collection(CollectionNames.employees)
    const employeeDoc = employeesCollection.doc(id)
    const employeeRef = await employeeDoc.get()
    if (!employeeRef.data())
      return res.status(404).json({
        error: true,
        message: 'Employee not found!'
      })

    if (params?.phone) {
      const employeeSnapshot = await employeesCollection
        .where('phone', '==', params.phone)
        .get()
      if (!employeeSnapshot.empty) {
        const employeeEmail = await employeeSnapshot.docs[0].get('email')
        if (employeeEmail !== params.email) {
          return res.status(400).json({
            error: true,
            message: 'Phone existed'
          })
        }
      }

      const authUserByPhone = await findUser({
        field: 'phone',
        value: params.phone
      })
      if (!authUserByPhone.empty) {
        const employeePhone = await employeeSnapshot.docs[0].get('phone')
        if (employeePhone === params.phone) {
          return res.status(400).json({
            error: true,
            message: 'Phone existed'
          })
        }
      }
    }

    await employeeDoc.update({
      ...params,
      updatedAt: Timestamp.now()
    })
    return res.status(200).json({
      success: true,
      message: 'Successfully!'
    })
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const getEmployeeById = async (id: string, res: Response) => {
  try {
    const employeesCollection = adminDb.collection(CollectionNames.employees)
    const employeeDoc = await employeesCollection.doc(id).get()

    if (!employeeDoc || !employeeDoc.exists)
      return res.status(400).json({
        error: true,
        message: 'Employee not exists'
      })

    const employeeData = employeeDoc.data()
    return res.status(200).json({
      success: true,
      message: 'Successfully!',
      data: employeeData
    })
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const getAllEmployees = async (res: Response) => {
  try {
    const employeesCollection = adminDb.collection(CollectionNames.employees)
    const snapshot = await employeesCollection.get()

    if (!snapshot)
      return res.status(400).json({
        error: true,
        message: 'Error'
      })

    const employees = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data()
    }))
    return res.status(200).json({
      success: true,
      message: 'Successfully!',
      data: employees
    })
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

export {
  verifyEmailLink,
  completeCreateEmployee,
  addEmployee,
  removeEmployee,
  updateEmployee,
  getEmployeeById,
  getAllEmployees
}

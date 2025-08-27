import { Response } from 'express'
import {
  comparePassword,
  generateJWT,
  getRandom6DigitsOtp,
  hashedPassword
} from '@/utils'
import { adminDb, CollectionNames, Role } from '@/firebase'
import { DocumentData, Timestamp } from 'firebase-admin/firestore'
import ms from 'ms'
import { JwtPayload } from 'jsonwebtoken'
import { CreateEmployeeParams, ValidateOtpParams } from '@/types'
import { sendVerificationLinkByMail } from '../mailService'

const findUser = async ({ value, field }: { value: string; field: string }) => {
  const authUsersRef = adminDb.collection(CollectionNames.auth_users)
  const snapshot = await authUsersRef.where(field, '==', value).get()
  return snapshot
}

const findOrCreatePhoneUser = async ({
  phone,
  role
}: {
  phone: string
  role: Role
}) => {
  const authUsersRef = adminDb.collection(CollectionNames.auth_users)
  const snapshot = await findUser({
    field: 'phone',
    value: phone as string
  })

  if (!snapshot) return null
  // return exist user
  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0]
    const user = userDoc.data()
    return { ...user, uid: userDoc.id }
  }

  // create new phone user
  const userRef = await authUsersRef.add({
    phone,
    role,
    createdAt: Timestamp.now()
  })

  const userDoc = await userRef.get()
  const user = userDoc.data() as DocumentData
  return {
    ...user,
    uid: userDoc.id
  }
}
const createOtp = async ({
  dataField,
  data,
  res
}: {
  dataField: 'email' | 'phone'
  data: string
  res: Response
}) => {
  try {
    // send otp using twilio
    const otp = getRandom6DigitsOtp()
    // await twilioClient.messages.create({
    //   body: `Your verification code is ${otp}`,
    //   to: phone,
    //   from: process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER,
    // });

    const otpDocRef = adminDb
      .collection(CollectionNames.otp_verifications)
      .doc(data)
    const otpDoc = await otpDocRef.get()

    if (otpDoc.exists) {
      const data = otpDoc.data()
      const now = Date.now()
      const expiredAt = data?.expiredAt?.toMillis() || 0

      if (data?.isVerified || now >= expiredAt) {
        await otpDocRef.delete()
      } else {
        return res.status(200).json({
          message: 'OTP already sent to this email',
          success: true
        })
      }
    }

    await otpDocRef.set({
      ...(dataField === 'email' ? { email: data } : { phone: data }),
      otp,
      createdAt: Timestamp.now(),
      // expires in 15 minutes
      expiredAt: Timestamp.fromDate(new Date(Date.now() + ms('15 minutes'))),
      isVerified: false
    })

    return res.status(200).json({
      message: 'Successfully sent otp: OTP is ' + otp,
      success: true
    })
  } catch (error: any) {
    console.warn('send-sms-otp error:', error)
    return res.status(error?.status || 500).json({
      message: error?.message || 'Something wrong!',
      error: true
    })
  }
}

const validateOtp = async ({
  userField,
  data,
  otp,
  res
}: ValidateOtpParams) => {
  try {
    const docRef = adminDb
      .collection(CollectionNames.otp_verifications)
      .doc(userField === 'email' ? data.email : data.phone)
    const doc = await docRef.get()

    if (!doc.exists) {
      return res.status(400).json({ error: true, message: 'OTP not found' })
    }

    const docData = doc.data()
    if (
      docData?.otp !== otp ||
      docData?.isVerified ||
      (docData?.expiredAt?.toMillis() || 0) < new Date().getTime()
    ) {
      return res.status(400).json({
        error: true,
        message: 'OTP Error, please try again later!'
      })
    }

    await docRef.update({ isVerified: true })
    let user: any
    if (userField === 'email') {
      const { error, message, ...userEmail } = await findEmailUser({
        email: data.email,
        password: data.password
      })
      if (error) return res.status(400).json({ error, message })
      user = userEmail
    } else {
      user = await findOrCreatePhoneUser({
        phone: data.phone,
        role: 'owner'
      })
    }
    if (!user) {
      return res.status(400).json({
        error: true,
        message: 'Error while get user!'
      })
    }

    const sessionCookie = generateJWT(
      {
        ...(userField === 'phone'
          ? { phone: data.phone }
          : { email: data.email }),
        uid: user?.uid,
        role: user?.role || 'employee'
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
  } catch (error: any) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || 'Internal Server Error'
    })
  }
}

const verifySessionCookie = async ({
  userData,
  res
}: {
  userData: JwtPayload
  res: Response
}) => {
  try {
    const { phone, email } = userData

    if (!phone && !email)
      return res.status(400).json({ error: true, message: 'Invalid token' })

    const snapshot = await findUser({
      field: phone ? 'phone' : 'email',
      value: phone || email
    })

    if (!snapshot || snapshot.empty) {
      return res.status(400).json({ error: true, message: 'Invalid token' })
    }

    const userDoc = snapshot.docs[0]
    const user = userDoc.data()

    return res
      .status(200)
      .json({ success: true, user: { ...user, uid: userDoc.id } })
  } catch (err) {
    return res
      .status(400)
      .json({ error: true, message: 'Invalid or expired token' })
  }
}

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

    const pwHashed = await hashedPassword(password)
    const authUsersRef = adminDb.collection(CollectionNames.auth_users)
    const userRef = await authUsersRef.add({
      email,
      username,
      password: pwHashed,
      role: 'employee',
      createdAt: Timestamp.now()
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
    const employeeDoc = await employeesCollection.add({
      ...params,
      createdAt: Timestamp.now()
    })

    const token = generateJWT({
      uid: employeeDoc?.id,
      role: params.role,
      email: params.email
    })

    await sendVerificationLinkByMail({
      email: params.email,
      name: params.name,
      verificationLink: `http://localhost:3000/verify-email?token=${token}`
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

const findEmailUser = async ({
  email,
  password
}: {
  email: string
  password: string
}) => {
  const snapshot = await findUser({ field: 'email', value: email })
  if (snapshot.empty) return { error: true, message: 'Invalid credentials' }
  const userDoc = snapshot.docs[0]
  const user = userDoc.data()

  const match = await comparePassword(password, user.password)

  if (!match) return { error: true, message: 'Invalid password' }

  return {
    ...user,
    uid: userDoc.id
  }
}

const loginByEmail = async (
  {
    email,
    password
  }: {
    email: string
    password: string
  },
  res: Response
) => {
  try {
    const {
      message,
      error = false,
      ...user
    } = await findEmailUser({ email, password })
    if (error) {
      return res.json(400).json({ message, error })
    }
    const otp = getRandom6DigitsOtp()
    // await twilioClient.messages.create({
    //   body: `Your verification code is ${otp}`,
    //   to: phone,
    //   from: process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER,
    // });

    const otpDocRef = adminDb
      .collection(CollectionNames.otp_verifications)
      .doc(email)
    const otpDoc = await otpDocRef.get()

    if (otpDoc.exists) {
      const data = otpDoc.data()
      const now = Date.now()
      const expiredAt = data?.expiredAt?.toMillis() || 0

      if (data?.isVerified || now >= expiredAt) {
        await otpDocRef.delete()
      } else {
        return res.status(200).json({
          message: 'OTP already sent to this email',
          success: true
        })
      }
    }

    await otpDocRef.set({
      email,
      otp,
      createdAt: Timestamp.now(),
      // expires in 15 minutes
      expiredAt: Timestamp.fromDate(new Date(Date.now() + ms('15 minutes'))),
      isVerified: false
    })

    return res.status(200).json({
      message: 'Successfully sent otp: OTP is ' + otp,
      success: true
    })
  } catch (error: any) {
    return res
      .status(error?.status || 500)
      .json({ error: true, message: error?.message || 'Internal Server Error' })
  }
}

export {
  createOtp,
  verifySessionCookie,
  validateOtp,
  verifyEmailLink,
  completeCreateEmployee,
  getAllEmployees,
  getEmployeeById,
  addEmployee,
  removeEmployee,
  loginByEmail
}

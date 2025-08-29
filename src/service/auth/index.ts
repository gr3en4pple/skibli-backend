import { Response } from 'express'
import { comparePassword, generateJWT, getRandom6DigitsOtp } from '@/utils'
import { adminDb, CollectionNames } from '@/firebase'
import { DocumentData, Timestamp } from 'firebase-admin/firestore'
import ms from 'ms'
import { JwtPayload } from 'jsonwebtoken'
import type { ValidateOtpParams, Role } from '@/types'
import { sendSMSOtp } from '@/service/twilio'
import { sendEmailOtp } from '../mail'

const findUser = async ({ value, field }: { value: string; field: string }) => {
  const authUsersRef = adminDb.collection(CollectionNames.auth_users)
  const snapshot = await authUsersRef.where(field, '==', value).get()
  return snapshot
}

const validateUserEmailPassword = async ({
  email,
  password
}: {
  email: string
  password: string
}) => {
  const snapshot = await findUser({ field: 'email', value: email })
  if (!snapshot || snapshot.empty)
    return { error: true, message: 'Invalid credentials' }
  const userDoc = snapshot.docs[0]
  const user = userDoc.data()

  const match = await comparePassword(password, user.password)

  if (!match) return { error: true, message: 'Invalid password' }

  return {
    ...user,
    uid: userDoc.id
  }
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
const createOtp = async (
  {
    dataField,
    data
  }: {
    dataField: 'email' | 'phone'
    data: string
  },
  res: Response
) => {
  try {
    const otpDocRef = adminDb
      .collection(CollectionNames.otp_verifications)
      .doc(data)
    const otpDoc = await otpDocRef.get()

    // check if otp existed
    if (otpDoc.exists) {
      const data = otpDoc.data()
      const now = Date.now()
      const expiredAt = data?.expiredAt?.toMillis() || 0

      // otp verified || expired => delete otp
      if (data?.isVerified || now >= expiredAt) {
        await otpDocRef.delete()
      } else {
        return res.status(200).json({
          message: 'OTP already sent to this email',
          success: true
        })
      }
    }

    // send otp
    const otp = getRandom6DigitsOtp()
    if (dataField === 'phone') {
      await sendSMSOtp({ otp, phone: data })
    } else {
      await sendEmailOtp({ email: data, otp })
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
      message: 'Internal Server Error',
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
      const { error, message, ...userEmail } = await validateUserEmailPassword({
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
    } = await validateUserEmailPassword({ email, password })
    if (error) {
      return res.status(400).json({ message, error })
    }

    return await createOtp({ data: email, dataField: 'email' }, res)
  } catch (error: any) {
    return res
      .status(error?.status || 500)
      .json({ error: true, message: error?.message || 'Internal Server Error' })
  }
}

export { findUser, createOtp, validateOtp, verifySessionCookie, loginByEmail }

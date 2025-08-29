import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  auth: {
    user: process.env.NODEMAILER_MAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
})

const generateEmailVerificationLink = (token: string) =>
  `http://localhost:3000/verify-email?token=${token}`

const sendEmailVerificationLink = async ({
  email,
  name,
  verificationLink
}: {
  email: string
  name?: string
  verificationLink: string
}) => {
  await transporter.sendMail({
    from: `${process.env.NODEMAILER_MAIL}`,
    to: email,
    subject: 'Verify your account',
    html: `
        <p>Hello ${name || 'employee'},</p>
        <p>Please click the link below to verify your account and set your password:</p>
        <a href="${verificationLink}">Verify link:${verificationLink}</a>
      `
  })
}

const sendEmailOtp = async ({
  email,
  name,
  otp
}: {
  email: string
  name?: string
  otp: string
}) => {
  await transporter.sendMail({
    from: `${process.env.NODEMAILER_MAIL}`,
    to: email,
    subject: 'Verify your account',
    html: `
        <p>Hello ${name || 'employee'},</p>
        <p>Please click the link below to verify your account and set your password:</p>
        <p>Your OTP is </p>
        <h1 style="font-size:52px;font-weight:700">${otp}</h1>
      `
  })
}

export {
  generateEmailVerificationLink,
  sendEmailVerificationLink,
  sendEmailOtp
}

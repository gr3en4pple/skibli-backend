import nodemailer from 'nodemailer'

const generateEmailVerificationLink = (token: string) =>
  `http://localhost:3000/verify-email?token=${token}`

const sendVerificationLinkByMail = async ({
  email,
  name,
  verificationLink
}: {
  email: string
  name?: string
  verificationLink: string
}) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    auth: {
      user: process.env.NODEMAILER_MAIL,
      pass: process.env.NODEMAILER_PASSWORD
    }
  })
  console.log('verificationLink:', verificationLink)

  await transporter.sendMail({
    from: `${process.env.NODEMAILER_MAIL}`,
    to: email,
    subject: 'Verify your account',
    html: `
        <p>Hello ${name || 'employee'},</p>
        <p>Please click the link below to verify your account and set your password:</p>
        <a href="${verificationLink}">Verify & Setup Account</a>
      `
  })
}

export { generateEmailVerificationLink, sendVerificationLinkByMail }

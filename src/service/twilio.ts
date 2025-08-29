import twilio from 'twilio'

const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH)

const sendSMSOtp = async ({ otp, phone }: { otp: string; phone: string }) => {
  return await twilioClient.messages.create({
    body: `Your verification code is ${otp}`,
    to: phone,
    from: process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER
  })
}

export { sendSMSOtp }

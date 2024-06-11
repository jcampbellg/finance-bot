import nodemailer from 'nodemailer'

if (!process.env.EMAIL_HOST || !process.env.EMAIL_PORT || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Please set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS in .env')
  process.exit(1)
}

const emailHost = process.env.EMAIL_HOST
const emailPort = process.env.EMAIL_PORT
const emailUser = process.env.EMAIL_USER
const emailPass = process.env.EMAIL_PASS

export default async function mailOTP(fullName: string, email: string) {
  const transport = nodemailer.createTransport({
    host: emailHost,
    port: parseInt(emailPort),
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  })

  await transport.sendMail({
    from: `"Bync Bot" <noreply@inspirahn.org>`,
    to: `${fullName} <${email}>`,
    subject: 'OTP',
    text: 'Your OTP is 123456',
  })
}
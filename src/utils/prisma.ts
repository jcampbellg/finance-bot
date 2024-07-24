import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient().$extends({
  // model: {
  //   user: {
  //     async signUp(email: string) {
  //       await prisma.user.create({ data: { email } })
  //     },
  //   },
  // },
})

export default prisma
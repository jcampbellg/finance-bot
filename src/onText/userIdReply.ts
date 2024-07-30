import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import noUserSend from '@onSend/noUserSend'
import { User } from '@prisma/client'
import xprisma from '@utils/xprisma'

export default async function userIdReply(params: ConversationProps, next: NextFunction<User>) {
  const { ctx, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const userShare = await xprisma.user.findUnique(text)

  if (!userShare) {
    await noUserSend(params)
    return
  }

  next(params, userShare)
}
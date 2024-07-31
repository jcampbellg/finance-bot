import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { mathEval } from '@utils/isValid'
import xprisma from '@utils/xprisma'

export default async function amountReply(params: ConversationProps, next: NextFunction<number>) {
  const { bot, ctx, chatId, text, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const amount = mathEval(text)
  if (amount.isError) {
    await bot.sendMessage(chatId, amount.error)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    edit: {
      ...conversation.edit,
      amount: amount.value as number
    }
  })

  next(amount.value as number)
}
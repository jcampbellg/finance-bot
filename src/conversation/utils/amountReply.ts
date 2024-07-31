import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { mathEval } from '@utils/isValid'

export default async function amountReply(params: ConversationProps, next: NextFunction<number>) {
  const { bot, ctx, chatId, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const amount = mathEval(text)
  if (amount.isError) {
    await bot.sendMessage(chatId, amount.error)
    return
  }

  next(amount.value as number)
}
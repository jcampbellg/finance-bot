import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { dateEval } from '@utils/isValid'

export default async function dateReply(params: ConversationProps, next: NextFunction<string>) {
  const { bot, ctx, chatId, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const dateString = dateEval(text)
  if (dateString.isError) {
    await bot.sendMessage(chatId, dateString.error)
    return
  }

  next(dateString.value)
}
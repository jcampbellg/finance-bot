import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { titleEval } from '@utils/isValid'

export default async function stringReply(params: ConversationProps, next: NextFunction<string>) {
  const { bot, ctx, chatId, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const description = titleEval(text)
  if (description.isError) {
    await bot.sendMessage(chatId, description.error)
    return
  }

  next(description.value)
}
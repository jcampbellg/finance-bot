import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { currencyEval } from '@utils/isValid'
import xprisma from '@utils/xprisma'

export default async function currencyReply(params: ConversationProps, next: NextFunction<string>) {
  const { bot, ctx, chatId, text, conversation } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const currency = currencyEval(text)
  if (currency.isError) {
    await bot.sendMessage(chatId, currency.error)
    return
  }

  await xprisma.conversation.update(conversation.id, {
    edit: {
      ...conversation.edit,
      currency: currency.value
    }
  })

  next(currency.value)
}
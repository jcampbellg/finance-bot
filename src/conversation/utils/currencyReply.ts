import { ConversationProps, NextFunction } from '@customTypes/messageTypes'
import { currencyEval } from '@utils/isValid'

export default async function currencyReply(params: ConversationProps, next: NextFunction<string>) {
  const { bot, chatId, text, ctx, query } = params

  const userCurrency = ctx ? text : (query?.data || '')

  const currency = currencyEval(userCurrency)
  if (currency.isError) {
    await bot.sendMessage(chatId, currency.error)
    return
  }

  next(currency.value)
}
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { PaymentIncome } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'

type IncomesListProps = {
  callbackCreate: string
  callbackAccountPrefix: string
  text: string,
  btn: 'end' | 'menu'
}

export default async function incomesListMessage(params: ConversationPropsWithBookSelected, { callbackCreate, callbackAccountPrefix, text: botText, btn }: IncomesListProps) {
  const { bot, query, chatId, user } = params

  const incomes = await xprisma.income.findMany(user)
  const groupedincomes: PaymentIncome[][] = chunkIt(incomes).size(2)

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: '🤑 Crear Ingreso', callback_data: callbackCreate }],
    ...groupedincomes.map((group) => group.map((i) => ({
      text: `${i.description}${!!i.transactions.length ? ` (${i.transactions.length} Pagos)` : ''}`,
      callback_data: `${callbackAccountPrefix}${i.id}`
    }))),
    ...(btn === 'end' ? [endBtn] : [menuBtn])
  ]

  if (query) {
    await bot.editMessageText(botText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
    return
  }

  await bot.sendMessage(chatId, botText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}
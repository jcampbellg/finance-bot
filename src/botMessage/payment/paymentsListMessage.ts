import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { Payment } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'

type AccountProps = {
  callbackCreate: string
  callbackAccountPrefix: string
  text: string,
  btn: 'end' | 'menu'
  filterNotPaid?: boolean
}

export default async function paymentsListMessage(params: ConversationPropsWithBookSelected, { filterNotPaid, callbackCreate, callbackAccountPrefix, text: botText, btn }: AccountProps) {
  const { bot, query, chatId, user } = params

  const payments = await xprisma.payment.findMany(user, filterNotPaid)
  const groupedPayments: Payment[][] = chunkIt(payments).size(3)

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: '💵 Crear Pago Fijo', callback_data: callbackCreate }],
    ...groupedPayments.map((group) => group.map((account) => ({
      text: account.description,
      callback_data: `${callbackAccountPrefix}${account.id}`
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
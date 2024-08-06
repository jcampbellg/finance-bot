import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { PaymentIncome } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'
import { MAX_PAYMENTS } from '@utils/constant'
import budgetBtn from '@buttons/budgetBtn'

type PaymentsListProps = {
  callbackCreate: string
  callbackPrefix: string
  text: string,
  btn: 'end' | 'menu' | 'budget'
}

export default async function paymentsListMessage(params: ConversationPropsWithBookSelected, { callbackCreate, callbackPrefix, text: botText, btn }: PaymentsListProps) {
  const { bot, query, chatId, user } = params

  const payments = await xprisma.payment.findMany(user)
  const groupedPayments: PaymentIncome[][] = chunkIt(payments).size(2)

  const canCreate = MAX_PAYMENTS > payments.length

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    ...(canCreate ? [[{ text: '💵 Crear Pago Fijo', callback_data: callbackCreate }]] : []),
    ...groupedPayments.map((group) => group.map((p) => ({
      text: `${p.description}${!!p.transactions.length ? ` (${p.transactions.length} Pagos)` : ''}`,
      callback_data: `${callbackPrefix}${p.id}`
    }))),
    ...(btn === 'budget' ? [budgetBtn] : (btn === 'end' ? [endBtn] : [menuBtn]))
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
import { ConversationProps, SendProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { AccountWithBalanceAndFiles } from '@customTypes/prismaTypes'

type AccountProps = {
  callbackCreate: string
  callbackAccountPrefix: string
}

export default async function accountsSend(params: ConversationProps, send: SendProps, { callbackCreate, callbackAccountPrefix }: AccountProps) {
  const { bot, query, chatId, user } = params

  const accounts = await xprisma.account.findMany(user)
  const groupedAccounts: AccountWithBalanceAndFiles[][] = chunkIt(accounts).size(3)

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    ...(send.keyboardTop || []),
    [{ text: '🏦 Crear Cuenta', callback_data: callbackCreate }],
    ...groupedAccounts.map((group) => group.map((account) => ({
      text: account.description,
      callback_data: `${callbackAccountPrefix}_${account.id}`
    }))),
    ...(send.keyboardDown || [])
  ]

  if (query) {
    await bot.editMessageText(send.text, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
    return
  }

  await bot.sendMessage(chatId, send.text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}
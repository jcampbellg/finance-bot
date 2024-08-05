import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'
import { chunkIt } from '@array-utils/chunk-it'
import { AccountWithBalance } from '@customTypes/prismaTypes'
import endBtn from '@buttons/endBtn'
import menuBtn from '@buttons/menuBtn'

type AccountsListProps = {
  callbackCreate: string
  callbackAccountPrefix: string
  text: string,
  btn: 'end' | 'menu'
}

export default async function accountsListMessage(params: ConversationPropsWithBookSelected, { callbackCreate, callbackAccountPrefix, text: botText, btn }: AccountsListProps) {
  const { bot, query, chatId, user } = params

  const accounts = await xprisma.account.findMany(user)
  const groupedAccounts: AccountWithBalance[][] = chunkIt(accounts).size(3)

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [{ text: '🏦 Crear Cuenta', callback_data: callbackCreate }],
    ...groupedAccounts.map((group) => group.map((account) => ({
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
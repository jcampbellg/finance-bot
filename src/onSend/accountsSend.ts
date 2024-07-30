import { ConversationProps, SendProps } from '@customTypes/messageTypes'
import TelegramBot from 'node-telegram-bot-api'

export default async function accountsSend(params: ConversationProps, send: SendProps) {
  const { bot, query, chatId } = params

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    ...(send.keyboardTop || []),
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
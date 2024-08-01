import { ConversationProps } from '@customTypes/messageTypes'
import TelegramBot from 'node-telegram-bot-api'

type AccountProps = {
  callbackYes: string
  callbackNo: string
  text: string
}

export default async function confirmMessage(params: ConversationProps, { callbackYes, callbackNo, text: botText }: AccountProps) {
  const { bot, query, chatId } = params

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [[{ text: '✅ Sí', callback_data: callbackYes }, { text: '❌ No', callback_data: callbackNo }]]

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
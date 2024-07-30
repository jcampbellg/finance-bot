import { ConversationProps } from '@customTypes/messageTypes'
import TelegramBot from 'node-telegram-bot-api'

type DataProps = {
  action: string
  callbackYes: string
  callbackNo: string
}

export default async function booleanSend(params: ConversationProps, data: DataProps) {
  const { bot, query, chatId } = params

  const text = `¿Estás seguro de que quieres ${data.action}?\n\nPor favor, confirma si deseas proceder. ¡Gracias!`
  const keyboard: TelegramBot.InlineKeyboardButton[][] = [[{ text: '✅ Sí', callback_data: data.callbackYes }, { text: '❌ No', callback_data: data.callbackNo }]]

  if (query) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
    return
  }

  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
}
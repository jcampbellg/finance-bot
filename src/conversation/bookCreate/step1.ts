import endBtn from '@buttons/endBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import TelegramBot from 'node-telegram-bot-api'

export default async function step1(params: ConversationProps) {
  const { conversation, bot, query, chatId } = params

  await xprisma.conversation.newSubject(conversation.id, {
    subject: 'book_create',
    subSubject: 'description'
  })

  const botText = `📚 Vamos a crear un nuevo libro contable.\n¿Cómo te gustaría llamarlo?`
  const botButtons: TelegramBot.InlineKeyboardButton[][] = [endBtn]

  if (!!query) {
    await bot.editMessageText(botText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: botButtons
      }
    })

    return
  }

  await bot.sendMessage(chatId, botText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: botButtons
    }
  })
}
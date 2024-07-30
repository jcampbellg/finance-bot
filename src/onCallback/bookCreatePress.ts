import menuBtn from '@buttons/menuBtn'
import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export async function bookCreatePress(params: ConversationProps) {
  const { query, bot, conversation, chatId } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subject: 'bookCreate',
    subSubject: 'title'
  })

  await bot.editMessageText(`📚 Vamos a crear un nuevo libro contable. ¿Cómo te gustaría llamarlo?`, {
    chat_id: chatId,
    message_id: query.message.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [menuBtn]
    }
  })
}
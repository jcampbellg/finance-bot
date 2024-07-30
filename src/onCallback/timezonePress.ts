import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'

export default async function timezonePress(params: ConversationProps) {
  const { bot, query, conversation, chatId, firstName } = params

  if (!query) {
    throw new Error('query is required')
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subSubject: 'end'
  })

  const timezone = query.data.replace('timezone_', '')

  await xprisma.user.update(chatId, { timezone: timezone })

  await bot.editMessageText(`¡Hola ${firstName}! 👋\n\n¡Bienvenido a Bync Bot! Veo que estás en la zona horaria <b>${timezone}</b>.\n¡Espero que tengas un día increíble! Si necesitas algo, estoy aquí para ayudarte.`, {
    message_id: query.message.message_id,
    chat_id: chatId,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Cambiar País', callback_data: 'country_change' }],
        [{ text: '¡Estoy Listo!', callback_data: 'menu' }]
      ]
    }
  })
}
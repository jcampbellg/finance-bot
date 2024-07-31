import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import ct from 'countries-and-timezones'
import step1 from './step1'

export default async function step4(params: ConversationProps) {
  const { bot, query, chatId, firstName } = params

  if (!query) {
    throw new Error('query is required')
  }

  const timezone = query.data.replace('timezone_', '')

  const exists = ct.getTimezone(timezone)

  if (!exists) {
    await bot.editMessageText(`¡Vaya, ${firstName}! No pude encontrar esa zona horaria. 😅\n\n¿Podrías verificarlo y enviármelo de nuevo?\n¡Gracias por tu paciencia!`, {
      message_id: query.message.message_id,
      chat_id: chatId
    })
    await step1(params)
    return
  }

  await xprisma.conversation.newSubject(params.conversation.id, { subSubject: 'ready' })

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
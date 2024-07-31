import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import ct from 'countries-and-timezones'
import localizedCountries from 'localized-countries'

export default async function step3(params: ConversationProps) {
  const { bot, query, chatId, firstName, conversation } = params

  if (!query) {
    throw new Error('query is required')
  }

  const countryId = query.data.replace('country_', '')

  const data = ct.getCountry(countryId)

  if (!data) {
    await bot.editMessageText(`¡Vaya, ${firstName}! No pude encontrar las zonas horarias del país "${countryId}". 😅\n\n¿Podrías verificarlo y enviármelo de nuevo?\n¡Gracias por tu paciencia!`, {
      message_id: query.message.message_id,
      chat_id: chatId
    })
    return
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subSubject: 'timezone_select'
  })

  const countryName = localizedCountries('es').get(data.id)
  const timezones = data.timezones

  await bot.editMessageText(`¡Gracias por compartir que vives en ${countryName}! 🌍\n\nAhora, ¿podrías elegir una zona horaria de tu país? Esto nos ayudará a ajustar mejor nuestra comunicación.`, {
    message_id: query.message.message_id,
    chat_id: chatId,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Cambiar País', callback_data: 'country_change' }],
        ...timezones.map(tz => ([{ text: tz, callback_data: `timezone_${tz}` }]))
      ]
    }
  })
}
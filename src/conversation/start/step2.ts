import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import localizedCountries from 'localized-countries'

const countries = localizedCountries('es').array()

export default async function step2(params: ConversationProps) {
  const { bot, ctx, conversation, chatId, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const search = countries.filter(country => country.label.toLowerCase().includes(text.toLowerCase()) || country.code.toLowerCase().includes(text.toLowerCase()))

  if (search.length === 0) {
    await bot.sendMessage(chatId, `¡Vaya, ${ctx.chat.first_name}! No pude encontrar el país "${text.toUpperCase()}". 😅\n\n¿Podrías verificarlo y enviármelo de nuevo?\n¡Gracias por tu paciencia!`)
    return
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subSubject: 'country_select'
  })

  await bot.sendMessage(chatId, `Por favor, elige un país de la lista. ¡Gracias!`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        ...search.map(c => ([{ text: c.label, callback_data: `country_${c.code}` }]))
      ]
    }
  })
}
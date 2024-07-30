import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import ct from 'countries-and-timezones'
import localizedCountries from 'localized-countries'

const countries = localizedCountries('es').array()

export default async function countrySearchReply(params: ConversationProps) {
  const { bot, ctx, conversation, chatId, text } = params

  if (!ctx) {
    throw new Error('ctx is required')
  }

  const search = countries.filter(country => country.label.toLowerCase().includes(text.toLowerCase()) || country.code.toLowerCase().includes(text.toLowerCase()))

  if (search.length === 0) {
    await bot.sendMessage(chatId, `¡Vaya, ${ctx.chat.first_name}! No pude encontrar el país "${text.toUpperCase()}". 😅\n\n¿Podrías verificarlo y enviármelo de nuevo?\n¡Gracias por tu paciencia!`)
    return
  }

  const data = ct.getCountry(text.toUpperCase())

  if (!data) {
  }

  await xprisma.conversation.newSubject(conversation.id, {
    subSubject: 'countrySearch'
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
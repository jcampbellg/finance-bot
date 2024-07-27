import { ConversationProps } from '@customTypes/messageTypes'
import xprisma from '@utils/xprisma'
import ct from 'countries-and-timezones'
import localizeCountry from 'localized-countries'
import { onMenuBegin } from '@conversations/mainMenu'

export async function onStartBegin(params: ConversationProps) {
  const { bot, userId, ctx, conversation, firstName } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subject !== 'start') {
    onMenuBegin(params)
    return
  }

  await bot.sendMessage(userId, `¡Hola ${firstName}! 👋 Soy Bync Bot.\n\n¿Podrías decirme en qué país vives? Solo necesito el código de 2 letras.\n¡Gracias!`)
  return
}

export async function onStartText(params: ConversationProps) {
  const { bot, userId, ctx, conversation, text, firstName } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  if (conversation.subSubject === 'country') {
    const data = ct.getCountry(text.toUpperCase())

    if (!data) {
      await bot.sendMessage(userId, `¡Vaya, ${ctx.chat.first_name}! No pude encontrar el país "${text.toUpperCase()}". 😅\n\n¿Podrías verificarlo y enviármelo de nuevo con el código de 2 letras correcto?\n¡Gracias por tu paciencia!`)
      return
    }

    await xprisma.conversation.updateSubject(conversation.id, 'start', 'timezone')

    const countryName = localizeCountry('es').get(data.id)

    const timezones = data.timezones.map(tz => `<code>${tz}</code>`).join('\n\n')
    await bot.sendMessage(userId, `¡Gracias por compartir que vives en ${countryName}! 🌍\n\nAhora, ¿podrías elegir una zona horaria de tu país? Esto nos ayudará a ajustar mejor nuestra comunicación.\n\n<i>Click para copiar y pega la zona horaria:</i>\n\n${timezones}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '🔄 Cambiar País', callback_data: 'change_country' }]]
      }
    })
    return
  }

  if (conversation.subSubject === 'timezone') {
    const data = ct.getTimezone(text)

    if (!data) {
      await bot.sendMessage(userId, `¡Vaya, ${firstName}! No pude encontrar la zona horaria "${text}". 😅\n\n¿Podrías verificarla y enviármela de nuevo?\n¡Gracias por tu paciencia!`)
      return
    }

    await xprisma.conversation.updateSubject(conversation.id, 'start', 'end')
    await xprisma.user.update(userId, { timezone: data.name })

    await bot.sendMessage(userId, `¡Hola ${firstName}! 👋\n\n¡Bienvenido a Bync Bot! Veo que estás en la zona horaria <b>${data.name}</b>.\n¡Espero que tengas un día increíble! Si necesitas algo, estoy aquí para ayudarte.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Cambiar País', callback_data: 'change_country' }],
          [{ text: '¡Estoy Listo!', callback_data: 'menu' }]
        ]
      }
    })
  }
}

export async function onStartCallback(params: ConversationProps) {
  const { bot, userId, query, conversation, firstName } = params

  if (!query) {
    throw new Error('query must be provided')
  }

  if (query.data === 'change_country') {
    await xprisma.conversation.updateSubject(conversation.id, 'start', 'country')
    await bot.sendMessage(userId, `¡Claro, ${firstName}! ¿Podrías decirme en qué país vives? Solo necesito el código de 2 letras.\n¡Gracias!`)
    return
  }
}
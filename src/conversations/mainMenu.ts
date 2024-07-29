import { ConversationProps, TelegramOptions } from '@customTypes/messageTypes'
import TelegramBot from 'node-telegram-bot-api'
import { newBookButtons } from '@conversations/newBook'
import xprisma from '@utils/xprisma'

export async function onMenuBegin(params: ConversationProps) {
  const { bot, userId, firstName, bookSelected, conversation } = params

  const noBook = !bookSelected ? '\n\n<i>Necesitas seleccionar un libro.</i>' : ''

  const botMsg = await bot.sendMessage(userId, `¡Hola ${firstName}!\n¿En qué puedo ayudarte?${noBook}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: await menuButtons(params)
    }
  })

  await xprisma.conversation.waiting(conversation.id, botMsg.message_id)
  return
}

export async function onConversationEnd(params: ConversationProps) {
  const { bot, userId, conversation } = params

  await xprisma.conversation.waiting(conversation.id)
  await bot.sendMessage(userId, '¡Hasta luego! 👋')
  return
}

export async function menuButtons({ bookSelected, user }: ConversationProps): Promise<TelegramBot.InlineKeyboardButton[][]> {
  const noBookSelected = !bookSelected
  const noBookCreated = user.books.length === 0

  if (noBookCreated) {
    return await newBookButtons(user)
  }

  if (noBookSelected) {
    return [
      [{ text: '📚 Ver y Seleccionar Libro', callback_data: 'books' }],
    ]
  }

  const canManageBudget = user.bookSelected?.role.permission !== 'SPENDER'

  return [
    [{ text: '🧾 Nueva Transacción', callback_data: 'new_transaction' }],
    [{ text: '📚 Ver y Seleccionar Libro', callback_data: 'books' }],
    ...(canManageBudget ? [[{ text: '📝 Preparar Presupuesto', callback_data: 'budget' }]] : []),
    [{ text: '📑 Resumen', callback_data: 'summary' }]
  ]
}

export function endButtons(canGoBack?: boolean | 'menu', callback_data: string = 'menu', text?: string): TelegramBot.InlineKeyboardButton[][] {
  const textInBack = canGoBack === 'menu' ? '☰ Menú' : text || '🔙 Volver'
  return [
    [
      ...(!!canGoBack ? [{ text: textInBack, callback_data }] : []),
      { text: '👋 Terminar Conversación', callback_data: 'end_conversation' }
    ]
  ]
}

export function yesAndNoButtons(description: string, callbackYes: string, callbackNo: string): [string, TelegramOptions] {
  return [
    `¿Estás seguro de que quieres eliminar <b>${description}</b>?\n\nPor favor, confirma si deseas proceder. ¡Gracias!`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '✅ Sí', callback_data: callbackYes }, { text: '❌ No', callback_data: callbackNo }]]
      }
    }
  ]
}
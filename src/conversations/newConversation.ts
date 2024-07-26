import { ConversationProps } from '@customTypes/messageTypes'
import prisma from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'

export async function onNewConversationBegin(params: ConversationProps) {
  const { bot, userId, firstName, bookSelected, conversation } = params

  const noBook = !bookSelected ? '\n\n<i>No tienes un libro contable seleccionado.</i>' : ''

  const botMsg = await bot.sendMessage(userId, `¡Hola ${firstName}!\n¿En qué puedo ayudarte?${noBook}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: newConversationButtons(params)
    }
  })

  await prisma.conversation.waiting(conversation.id, botMsg.message_id)
  return
}

export async function onNewConversationEnd(params: ConversationProps) {
  const { bot, userId, conversation } = params

  await prisma.conversation.waiting(conversation.id)
  await bot.sendMessage(userId, '¡Hasta luego! 👋')
  return
}

export function newConversationButtons({ bookSelected, user: { books } }: ConversationProps): TelegramBot.InlineKeyboardButton[][] {
  const noBookSelected = !bookSelected
  const noBookCreated = books.length === 0

  if (noBookCreated) {
    return [
      [{ text: '📚 Crear Libro', callback_data: 'new_book' }],
      [{ text: '📚 Añadir Libro Existente', callback_data: 'add_book' }],
    ]
  }

  if (noBookSelected) {
    return [
      [{ text: '📚 Ver y Seleccionar Libro', callback_data: 'books' }],
    ]
  }

  return [
    [{ text: '🧾 Nueva Transacción', callback_data: 'new_transaction' }],
    [{ text: '📚 Ver y Seleccionar Libro', callback_data: 'books' }],
    [{ text: '📝 Preparar Presupuesto', callback_data: 'books' }]
  ]
}



export function endButton(canGoBack?: boolean, callback_data: string = 'menu', text: string = '🔙 Volver'): TelegramBot.InlineKeyboardButton[][] {
  return [
    [
      ...(!!canGoBack ? [{ text, callback_data }] : []),
      { text: '👋 Terminar Conversación', callback_data: 'end_conversation' }
    ]
  ]
}
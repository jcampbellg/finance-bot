import { ConversationProps } from '@customTypes/messageTypes'
import prisma from '@utils/prisma'
import TelegramBot from 'node-telegram-bot-api'

export async function onNewConversationStart(params: ConversationProps) {
  const { bot, userId, ctx, firstName, bookSelected } = params

  if (!ctx) {
    throw new Error('ctx must be provided')
  }

  const noBook = !bookSelected ? '\n\n<i>No tienes un libro contable seleccionado.</i>' : ''

  await bot.sendMessage(userId, `¡Hola ${firstName}!\n¿En qué puedo ayudarte?${noBook}`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: newConversationButtons(params)
    }
  })
  return
}

export async function onNewConversationEnd(params: ConversationProps) {
  const { bot, userId, conversation } = params

  await prisma.conversation.waiting(conversation.id)
  await bot.sendMessage(userId, '¡Hasta luego! 👋')
  return
}

export function newConversationButtons({ bookSelected }: ConversationProps): TelegramBot.InlineKeyboardButton[][] {
  const noBook = !bookSelected
  if (noBook) {
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
import { ConversationProps } from '@customTypes/messageTypes'

export async function waitingForCommandOnStart({ bot, msg, query }: ConversationProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  await bot.sendMessage(userId, '¡Hasta pronto! 👋')
  return
}

export default async function waitingForCommand({ bot, userId }: ConversationProps) {



  await bot.sendMessage(userId, 'No entiendo ese comando.')
  return
}

export async function waitingForCommandNoBook({ bot, userId }: ConversationProps) {

  await bot.sendMessage(userId, 'Primero necesitas seleccionar un libro contable. Usa /libro.')
  return
}
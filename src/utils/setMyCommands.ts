import { MessageFromPrivate, QueryFromPrivate } from '@customTypes/messageTypes'
import TelegramBot from 'node-telegram-bot-api'

const commands = [
  {
    command: 'nueva',
    description: 'Crea una nueva transacción'
  }, {
    command: 'libro',
    description: 'Seleccionar libro contable con que trabajar'
  }, {
    command: 'presupuesto',
    description: 'Prepara tu presupuesto'
  }, {
    command: 'cambio',
    description: 'Crear un cambio de moneda'
  }, {
    command: 'resumen',
    description: 'Resumen de tu presupuesto y gastos del mes'
  }, {
    command: 'buscar',
    description: 'Buscar transacciones'
  }
]

type props = {
  bot: TelegramBot
  msg: MessageFromPrivate
  query?: QueryFromPrivate
} | {
  bot: TelegramBot
  msg?: MessageFromPrivate
  query: QueryFromPrivate
}

export default async function setMyCommands({ bot, msg, query }: props) {
  const chatId = msg?.chat.id || query?.message.chat.id as number
  const from = msg?.from || query?.from as TelegramBot.User

  await bot.setMyCommands(commands, {
    scope: {
      type: 'all_private_chats',
    },
    language_code: from.language_code
  })

  await bot.setMyCommands(commands, {
    scope: {
      type: 'chat',
      chat_id: chatId
    },
    language_code: from.language_code
  })
}

export async function clearMyCommands({ bot, msg, query }: props) {
  const chatId = msg?.chat.id || query?.message.chat.id as number
  const from = msg?.from || query?.from as TelegramBot.User

  await bot.setMyCommands([], {
    scope: {
      type: 'all_private_chats',
    },
    language_code: from.language_code
  })

  await bot.setMyCommands([], {
    scope: {
      type: 'chat',
      chat_id: chatId
    },
    language_code: from.language_code
  })
}

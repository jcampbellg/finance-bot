import TelegramBot from 'node-telegram-bot-api'

const commands = [
  {
    command: 'nueva',
    description: 'Crea una nueva transacción'
  }, {
    command: 'libros',
    description: 'Muestra tus libros contables'
  }, {
    command: 'configurar',
    description: 'Configura tu libro'
  }, {
    command: 'cancelar',
    description: 'Termina la conversación actual'
  }
]

export default async function setMyCommands(bot: TelegramBot, msg: TelegramBot.Message) {
  if (!msg.from || msg.from?.is_bot || msg.chat.type !== 'private') return

  await bot.setMyCommands(commands, {
    scope: {
      type: 'all_private_chats',
    },
    language_code: msg.from.language_code
  })

  await bot.setMyCommands(commands, {
    scope: {
      type: 'chat',
      chat_id: msg.chat.id
    },
    language_code: msg.from.language_code
  })
}

export async function clearMyCommands(bot: TelegramBot, msg: TelegramBot.Message) {
  if (!msg.from || msg.from?.is_bot || msg.chat.type !== 'private') return

  await bot.setMyCommands([], {
    scope: {
      type: 'all_private_chats',
    },
    language_code: msg.from.language_code
  })

  await bot.setMyCommands([], {
    scope: {
      type: 'chat',
      chat_id: msg.chat.id
    },
    language_code: msg.from.language_code
  })
}
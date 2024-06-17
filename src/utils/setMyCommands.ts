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

type Msg = {
  from: TelegramBot.Message['from']
  chat: TelegramBot.Message['chat']
}

export default async function setMyCommands(bot: TelegramBot, msg: Msg) {
  if (!msg.from || msg.from?.is_bot) return

  await bot.setMyCommands(commands, {
    scope: {
      type: 'all_private_chats',
    },
    language_code: 'es'
  })

  await bot.setMyCommands(commands, {
    scope: {
      type: 'chat',
      chat_id: msg.chat.id
    },
    language_code: 'es'
  })

  await bot.setMyCommands(commands, {
    scope: {
      type: 'all_private_chats',
    },
    language_code: 'en'
  })

  await bot.setMyCommands(commands, {
    scope: {
      type: 'chat',
      chat_id: msg.chat.id
    },
    language_code: 'en'
  })
}

export async function clearMyCommands(bot: TelegramBot, msg: TelegramBot.Message) {
  if (!msg.from || msg.from?.is_bot) return

  await bot.setMyCommands([], {
    scope: {
      type: 'all_private_chats',
    },
    language_code: 'es'
  })

  await bot.setMyCommands([], {
    scope: {
      type: 'chat',
      chat_id: msg.chat.id
    },
    language_code: 'es'
  })

  await bot.setMyCommands([], {
    scope: {
      type: 'all_private_chats',
    },
    language_code: 'en'
  })

  await bot.setMyCommands([], {
    scope: {
      type: 'chat',
      chat_id: msg.chat.id
    },
    language_code: 'en'
  })
}

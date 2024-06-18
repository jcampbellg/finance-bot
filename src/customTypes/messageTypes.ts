import TelegramBot from 'node-telegram-bot-api'

export type MessageFromPrivate =
  Omit<TelegramBot.Message, 'chat'> &
  {
    chat: Omit<TelegramBot.Message['chat'], 'type'> & { type: 'private' }
  }

export type QueryFromPrivate =
  Omit<TelegramBot.CallbackQuery, 'message' | 'data'> &
  Pick<Required<TelegramBot.CallbackQuery>, 'message'> &
  Pick<Required<TelegramBot.CallbackQuery>, 'data'>
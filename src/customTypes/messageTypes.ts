import TelegramBot from 'node-telegram-bot-api'

export type MessageFromPrivate =
  Omit<TelegramBot.Message, 'chat'> &
  {
    chat: Omit<TelegramBot.Message['chat'], 'type'> & { type: 'private' }
  }

export type MessageFromGroup =
  Omit<TelegramBot.Message, 'chat'> &
  {
    chat: Omit<TelegramBot.Message['chat'], 'type'> & { type: 'group' }
  }

export type QueryFromPrivate =
  Omit<TelegramBot.CallbackQuery, 'message' | 'data'> &
  Pick<Required<TelegramBot.CallbackQuery>, 'message'> &
  Pick<Required<TelegramBot.CallbackQuery>, 'data'>

export type MsgAndQueryProps = {
  bot: TelegramBot
  msg: MessageFromPrivate
  query?: QueryFromPrivate
} | {
  bot: TelegramBot
  msg?: MessageFromPrivate
  query: QueryFromPrivate
}

export type MsgProps = {
  bot: TelegramBot
  msg: MessageFromPrivate
}

export type MsgGroupProps = {
  bot: TelegramBot
  msg: MessageFromGroup
}

export type QueryProps = {
  bot: TelegramBot
  query: QueryFromPrivate
}
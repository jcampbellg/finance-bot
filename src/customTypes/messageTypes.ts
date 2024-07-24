import TelegramBot from 'node-telegram-bot-api'
import { UserWithAll } from './prismaTypes'

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

export type MsgOrQueryProps = {
  bot: TelegramBot
} & (
    | { msg?: MessageFromPrivate; query: QueryFromPrivate }
    | { msg: MessageFromPrivate; query?: QueryFromPrivate }
  )

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

export type ConversationProps = {
  userId: number
  user: UserWithAll
  text: string
  bot: TelegramBot
} & (
    | { msg?: MessageFromPrivate; query: QueryFromPrivate }
    | { msg: MessageFromPrivate; query?: QueryFromPrivate }
  )
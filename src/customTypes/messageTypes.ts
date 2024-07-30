import TelegramBot from 'node-telegram-bot-api'
import { ByncUser } from '@customTypes/prismaTypes'

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
    | { ctx?: MessageFromPrivate; query: QueryFromPrivate }
    | { ctx: MessageFromPrivate; query?: QueryFromPrivate }
  )

export type MsgProps = {
  bot: TelegramBot
  ctx: MessageFromPrivate
}

export type MsgGroupProps = {
  bot: TelegramBot
  ctx: MessageFromGroup
}

export type QueryProps = {
  bot: TelegramBot
  query: QueryFromPrivate
}

export type ConversationProps = {
  chatId: number
  user: ByncUser
  bookSelected: ByncUser['bookSelected']
  conversation: ByncUser['conversation']
  firstName: string
  text: string
  bot: TelegramBot
} & (
    | { ctx?: MessageFromPrivate; query: QueryFromPrivate }
    | { ctx: MessageFromPrivate; query?: QueryFromPrivate }
  )

export type NextFunction<T> = (params: ConversationProps, value: T) => void

export type SendProps = {
  text: string
  keyboardTop?: TelegramBot.InlineKeyboardButton[][]
  keyboardDown?: TelegramBot.InlineKeyboardButton[][]
}
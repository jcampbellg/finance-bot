import TelegramBot from 'node-telegram-bot-api'
import { BookWithRole, ByncUser } from './prismaTypes'
import { Conversation } from '@prisma/client'

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
  userId: number
  user: ByncUser
  bookSelected: BookWithRole | null
  conversation: Conversation
  firstName: string
  text: string
  bot: TelegramBot
} & (
    | { ctx?: MessageFromPrivate; query: QueryFromPrivate }
    | { ctx: MessageFromPrivate; query?: QueryFromPrivate }
  )
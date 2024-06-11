import botReply from '@utils/botReply'
import TelegramBot from 'node-telegram-bot-api'
import { z } from 'zod'
import mailOTP from '@utils/mailOTP'
import dotenv from 'dotenv'
dotenv.config()

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

type Chats = {
  [chatId: number]: {
    command?: 'start' | 'onboarding'
    lang: 'es' | 'en'
  }
}

const chats: Chats = {}

bot.on('text', async (msg) => {
  const chatId = msg.chat.id
  const lang = chats[chatId]?.lang || (['en', 'es'].includes(msg.from?.language_code || '') && msg.from?.language_code) || 'en'
  const text = msg.text?.trim() || ''

  if (!chats[chatId]) {
    chats[chatId] = {
      lang: 'en'
    }
  }

  if (text === '/start') {
    chats[chatId] = { command: 'start', lang: 'en' }
    await bot.sendMessage(chatId, botReply.start)
    return
  }

  if (chats[chatId]?.command === 'start') {
    if (text === '/en' || text === '/es') {
      const lang = text.slice(1) as 'es' | 'en'
      chats[chatId] = {
        lang,
        command: 'onboarding'
      }
      await bot.sendMessage(chatId, botReply.language[lang])
      await bot.sendMessage(chatId, botReply.onboarding.welcome[lang])
      return
    } else {
      await bot.sendMessage(chatId, botReply.language.please)
      return
    }
  }

  if (chats[chatId]?.command === 'onboarding') {
    try {
      z.string().email().parse(text)
      await bot.sendMessage(chatId, botReply.onboarding.email.sendOTP[lang])
      await mailOTP(msg.chat.first_name || msg.chat.title || msg.chat.username || msg.from?.first_name || '', text)
      return
    } catch (err) {
      await bot.sendMessage(chatId, botReply.onboarding.email.invalid[lang])
      return
    }
  }
})
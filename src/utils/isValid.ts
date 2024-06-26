import { z } from 'zod'

export const isTitleValid = (text: string) => z.string().min(3).max(50).safeParse(text)

export const isCurrencyValid = (text: string) => z.string().regex(/[a-zA-Z]+/).length(3).safeParse(text)

export const isKeyValid = (text: string) => z.string().uuid().safeParse(text)

export const isMathValid = (text: string) => z.string().regex(/^[0-9+\-*/ ]+$/).safeParse(text)

export const isDateValid = (text: string) => z.string().regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).safeParse(text)
import { z } from 'zod'
import { create, all } from 'mathjs'

const config = {}
const math = create(all, config)

type ReturnType = {
  isError: true
  error: string
  isOk: false
  value: any
} | {
  isError: false
  error?: string
  isOk: true
  value: any
}

export const isTitleValid = (text: string) => z.string().min(3).max(50).safeParse(text)

export const isCurrencyValid = (text: string) => z.string().regex(/[a-zA-Z]+/).length(3).safeParse(text)

export const isKeyValid = (text: string) => z.string().uuid().safeParse(text)

export const isMathValid = (text: string) => z.string().regex(/^[0-9.+\-*/ ]+$/).safeParse(text)

export const isDateValid = (text: string) => z.string().regex(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).safeParse(text)

export const mathEval = (text: string): ReturnType => {
  const isValid = isMathValid(text)
  if (!isValid.success) {
    return {
      isError: true,
      error: 'Solo se permiten números y operaciones matemáticas simples en una linea.',
      isOk: false,
      value: text
    }
  }

  try {
    const amount = math.evaluate(text)
    if (Number.isNaN(amount)) {
      return {
        isError: true,
        error: 'La respuesta debe ser un número.',
        isOk: false,
        value: text
      }
    }

    return {
      isError: false,
      isOk: true,
      value: amount
    }
  } catch (err) {
    return {
      isError: true,
      error: 'La respuesta debe ser un número.',
      isOk: false,
      value: text
    }
  }
}

export const currencyEval = (text: string): ReturnType => {
  const isValid = isCurrencyValid(text)
  if (!isValid.success) {
    return {
      isError: true,
      error: 'La respuesta debe ser de 3 letras.',
      isOk: false,
      value: text
    }
  }

  return {
    isError: false,
    isOk: true,
    value: text.toUpperCase()
  }
}

export const titleEval = (text: string): ReturnType => {
  const isValid = isTitleValid(text)
  if (!isValid.success) {
    return {
      isError: true,
      error: 'La respuesta debe ser entre 3 y 50 caracteres.',
      isOk: false,
      value: text
    }
  }

  return {
    isError: false,
    isOk: true,
    value: text
  }
}
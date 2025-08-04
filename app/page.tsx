import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lunara Afiliados - Gestão Integrada',
  description: 'Sistema integrado de gestão para terapeutas e afiliados',
}

export default function HomePage() {
  // Redirecionar para dashboard por padrão
  redirect('/dashboard')
}
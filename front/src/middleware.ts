import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { TokenPayload } from './services/auth/decodeToken'
import { ADMIN, ESTUDANTE } from './consts'

// O token é verificado pelo backend, que é quem guarda o segredo de assinatura.
// Decodificar o JWT aqui aceitaria qualquer assinatura e tornaria as regras
// abaixo contornáveis com um cookie montado à mão.
type SessionCheck =
  | { status: 'valid'; payload: TokenPayload }
  | { status: 'invalid' }
  | { status: 'unavailable' }

function getApiUrl() {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_EDU_TRACE || ''
}

async function checkSession(token: string): Promise<SessionCheck> {
  const apiUrl = getApiUrl()

  if (!apiUrl) {
    console.error('API_URL não configurada, não é possível verificar a sessão')
    return { status: 'unavailable' }
  }

  try {
    const response = await fetch(`${apiUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (response.status === 401) {
      return { status: 'invalid' }
    }

    if (!response.ok) {
      return { status: 'unavailable' }
    }

    return { status: 'valid', payload: (await response.json()) as TokenPayload }
  } catch (error) {
    console.error('Erro ao verificar a sessão no backend:', error)
    return { status: 'unavailable' }
  }
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL('/', request.url))
}

function clearToken(response: NextResponse) {
  response.cookies.set('token', '', {
    path: '/',
    expires: new Date(0),
  })

  return response
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const pathname = request.nextUrl.pathname

  const isLoginPage = pathname === '/'
  const isPublicPage = isLoginPage || pathname === '/forgot-password'
  const changePasswordPage = '/alterar-dados'

  if (!token) {
    return isPublicPage ? NextResponse.next() : redirectToLogin(request)
  }

  const session = await checkSession(token)

  // Token recusado pelo backend: assinatura inválida, expirado ou usuário
  // inexistente. O cookie é descartado para não repetir a verificação a cada
  // navegação seguinte.
  if (session.status === 'invalid') {
    return clearToken(
      isPublicPage ? NextResponse.next() : redirectToLogin(request),
    )
  }

  // Backend indisponível: sem resposta confiável, nenhuma rota protegida é
  // liberada, mas o cookie é preservado para que a sessão volte quando a API
  // responder de novo.
  if (session.status === 'unavailable') {
    return isPublicPage ? NextResponse.next() : redirectToLogin(request)
  }

  const payload = session.payload

  // A senha do primeiro acesso foi definida pelo administrador. Até que o
  // usuário troque, nenhuma outra tela fica acessível — o backend recusa as
  // demais rotas de qualquer forma.
  if (payload.must_change_password && pathname !== changePasswordPage) {
    return NextResponse.redirect(new URL(changePasswordPage, request.url))
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  const isStudent = payload.id_level === ESTUDANTE
  const isAdmin = payload.id_level === ADMIN
  const restrictedPathsStudent = ['/visualizar', '/editar-anamnese', '/editar-pei', '/editar-triagem']
  const tryingToAccessRestricted = restrictedPathsStudent.some(path =>
    pathname.startsWith(path)
  )

  if (isStudent && tryingToAccessRestricted) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  const adminOnlyPaths = ['/admin']
  const tryingToAccessAdminOnly = adminOnlyPaths.some(path =>
    pathname.startsWith(path)
  )

  if (tryingToAccessAdminOnly && !isAdmin) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|assets|public|.*\\..*).*)'],
}

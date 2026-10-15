import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { SessionUser } from './services/auth/sessionUser'
import { findSessionCookie, isSecureSessionCookie } from './utils/sessionCookie'
import { registrationRedirect } from './utils/registrationRedirect'
import { canAccessPage } from './utils/pageAccess'
import { buildContentSecurityPolicy, createNonce } from './utils/contentSecurityPolicy'

// O token é verificado pelo backend, que é quem guarda o segredo de assinatura.
// Decodificar o JWT aqui aceitaria qualquer assinatura e tornaria as regras
// abaixo contornáveis com um cookie montado à mão.
type SessionCheck =
  | { status: 'valid'; payload: SessionUser }
  | { status: 'invalid' }
  | { status: 'unavailable' }

// Esta função roda no servidor, dentro do container do front, e não no navegador.
// API_URL e NEXT_PUBLIC_API_EDU_TRACE carregam o endereço publicado no host, que
// aqui aponta para o próprio container. INTERNAL_API_URL carrega o endereço do
// backend na rede interna, e os dois seguintes ficam como alternativa para quem
// roda fora do Docker, onde os dois endereços são o mesmo.
function getApiUrl() {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_EDU_TRACE ||
    ''
  )
}

async function checkSession(token: string): Promise<SessionCheck> {
  const apiUrl = getApiUrl()

  if (!apiUrl) {
    console.error(
      'INTERNAL_API_URL não configurada, não é possível verificar a sessão',
    )
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

    return { status: 'valid', payload: (await response.json()) as SessionUser }
  } catch (error) {
    console.error('Erro ao verificar a sessão no backend:', error)
    return { status: 'unavailable' }
  }
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL('/', request.url))
}

function clearToken(response: NextResponse, name: string) {
  response.cookies.set(name, '', {
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureSessionCookie(name),
  })

  return response
}

// A página só é renderizada pelas saídas que chamam este helper; os
// redirecionamentos não têm corpo. O Next lê o nonce da CSP enviada na
// requisição e o aplica aos próprios scripts, e o layout lê o x-nonce para os
// <Script> da aplicação.
function renderPage(request: NextRequest) {
  const nonce = createNonce()
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_EDU_TRACE,
    isDev: process.env.NODE_ENV === 'development',
  })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  return response
}

export async function middleware(request: NextRequest) {
  const sessionCookie = findSessionCookie(
    (name) => request.cookies.get(name)?.value,
  )
  const pathname = request.nextUrl.pathname

  const isLoginPage = pathname === '/' || pathname === '/login'
  const isPublicPage =
    isLoginPage ||
    pathname === '/forgot-password' ||
    pathname === '/definir-senha'
  const changePasswordPage = '/alterar-dados'

  if (!sessionCookie) {
    return isPublicPage ? renderPage(request) : redirectToLogin(request)
  }

  const session = await checkSession(sessionCookie.value)

  // Token recusado pelo backend: assinatura inválida, expirado ou usuário
  // inexistente. O cookie é descartado para não repetir a verificação a cada
  // navegação seguinte.
  if (session.status === 'invalid') {
    return clearToken(
      isPublicPage ? renderPage(request) : redirectToLogin(request),
      sessionCookie.name,
    )
  }

  // Backend indisponível: sem resposta confiável, nenhuma rota protegida é
  // liberada, mas o cookie é preservado para que a sessão volte quando a API
  // responder de novo.
  if (session.status === 'unavailable') {
    return isPublicPage ? renderPage(request) : redirectToLogin(request)
  }

  const payload = session.payload

  const registrationTarget = registrationRedirect(payload, pathname)
  if (registrationTarget) {
    return NextResponse.redirect(new URL(registrationTarget, request.url))
  }

  // A senha do primeiro acesso foi definida pelo administrador. Até que o
  // usuário troque, nenhuma outra tela fica acessível — o backend recusa as
  // demais rotas de qualquer forma.
  if (payload.must_change_password && pathname !== changePasswordPage) {
    return NextResponse.redirect(new URL(changePasswordPage, request.url))
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (!isPublicPage && !canAccessPage(pathname, payload.id_level)) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return renderPage(request)
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|assets|public|.*\\..*).*)'],
}
